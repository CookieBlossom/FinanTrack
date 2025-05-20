import { v4 as uuidv4 } from 'uuid';
import * as redis from 'redis';
import { promisify } from 'util';
import { IScraperCredentials, IScraperTask, IScraperTaskCreate, IScraperResult, IScraperStatus } from '../interfaces/IScraper';
import { DatabaseError } from '../utils/errors';

export class ScraperService {
  private client!: redis.RedisClientType;
  private tasks: Map<string, IScraperTask> = new Map();
  private pollInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Inicializar cliente Redis
    try {
      this.client = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
      });
      this.client.connect().catch(err => {
        console.error('Error al conectar con Redis:', err);
      });
      this.setupEventHandlers();

      // Iniciar polling de resultados
      this.startPolling();
    } catch (error) {
      console.error('Error al inicializar ScraperService:', error);
    }
  }

  private setupEventHandlers(): void {
    this.client.on('error', (err) => {
      console.error('Error en conexión Redis:', err);
    });
    
    this.client.on('connect', () => {
      console.log('Conectado a Redis satisfactoriamente');
    });
  }

  private startPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }

    // Revisar resultados cada 2 segundos
    this.pollInterval = setInterval(async () => {
      try {
        // Revisar resultados para cada tarea en progreso
        for (const [taskId, task] of this.tasks.entries()) {
          if (task.status === 'processing') {
            const credentials = task.credentials;
            const userId = credentials.rut || credentials.username;
            
            // Determinar la clave Redis basada en el tipo de tarea
            let key = `scraper:response:${userId}`;
            if (task.type) {
              key = `scraper:${task.type}:response:${userId}`;
            }

            // Verificar si ya hay respuesta
            const response = await this.client.get(key);
            if (response) {
              try {
                const result = JSON.parse(response);
                task.result = result;
                task.status = result.success ? 'completed' : 'failed';
                if (!result.success && result.message) {
                  task.error = result.message;
                }
                
                // Eliminar la respuesta de Redis una vez procesada
                await this.client.del(key);
              } catch (error) {
                console.error(`Error al procesar respuesta para tarea ${taskId}:`, error);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error en polling de resultados:', error);
      }
    }, 2000);
  }

  /**
   * Crea una nueva tarea de scraping
   */
  public async createTask(data: IScraperTaskCreate): Promise<IScraperTask> {
    try {
      // Validar credenciales
      const credentials = data.credentials;
      if (!credentials.password || ((!credentials.rut && !credentials.username))) {
        throw new DatabaseError('Credenciales incompletas');
      }

      // Crear ID único para la tarea
      const taskId = uuidv4();
      
      // Crear tarea
      const task: IScraperTask = {
        id: taskId,
        credentials,
        createdAt: new Date(),
        status: 'pending',
        type: data.type || 'default', // Tipo de scraper (saldos, movimientos, etc.)
        site: data.site || 'banco_estado' // Sitio a scrapear (por defecto banco_estado)
      };

      // Almacenar tarea en memoria
      this.tasks.set(taskId, task);

      // Determinar la cola Redis basada en el tipo de tarea
      let queueName = 'scraper:task';
      if (task.type && task.type !== 'default') {
        queueName = `scraper:${task.type}:task`;
      }

      // Enviar tarea a Redis
      const taskData = JSON.stringify({
        ...credentials,
        task_id: taskId,
        type: task.type,
        site: task.site
      });
      
      // Publicar en el canal correspondiente
      await this.client.publish(queueName, taskData);
      // También insertar en lista para asegurar procesamiento
      await this.client.lPush(queueName, taskData);

      // Cambiar estado a 'processing'
      task.status = 'processing';

      return task;
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Error al crear tarea de scraping: ${error}`);
    }
  }

  /**
   * Obtiene el estado de una tarea específica
   */
  public getTask(taskId: string): IScraperTask | null {
    const task = this.tasks.get(taskId);
    return task || null;
  }

  /**
   * Obtiene todas las tareas
   */
  public getAllTasks(): IScraperTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Obtiene el estado general del scraper
   */
  public getStatus(): IScraperStatus {
    let pendingTasks = 0;
    let processingTasks = 0;
    let completedTasks = 0;
    let failedTasks = 0;

    for (const task of this.tasks.values()) {
      switch (task.status) {
        case 'pending':
          pendingTasks++;
          break;
        case 'processing':
          processingTasks++;
          break;
        case 'completed':
          completedTasks++;
          break;
        case 'failed':
          failedTasks++;
          break;
      }
    }

    return {
      running: processingTasks > 0,
      pendingTasks,
      processingTasks,
      completedTasks,
      failedTasks
    };
  }

  /**
   * Limpia las tareas completadas o fallidas más antiguas
   */
  public cleanupOldTasks(maxAge: number = 24 * 60 * 60 * 1000): number { // Por defecto 24 horas
    const now = new Date();
    let count = 0;

    for (const [taskId, task] of this.tasks.entries()) {
      if ((task.status === 'completed' || task.status === 'failed') &&
          (now.getTime() - task.createdAt.getTime() > maxAge)) {
        this.tasks.delete(taskId);
        count++;
      }
    }

    return count;
  }
} 