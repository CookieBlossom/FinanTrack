import { Request, Response } from 'express';
import { ScraperService } from '../services/ScraperService';
import { IScraperTaskCreate } from '../interfaces/IScraper';
import { AuthRequest } from '../interfaces/IAuth';
import { DatabaseError } from '../utils/errors';

export class ScraperController {
  private scraperService: ScraperService;

  constructor() {
    this.scraperService = new ScraperService();
  }

  /**
   * Inicia una nueva tarea de scraping
   */
  public startScraping = async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      // Verificar que el usuario está autenticado
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      // Obtener datos del cuerpo de la solicitud
      const taskData: IScraperTaskCreate = req.body;

      // Validar datos básicos
      if (!taskData.credentials || (!taskData.credentials.rut && !taskData.credentials.username) || !taskData.credentials.password) {
        return res.status(400).json({ 
          message: 'Se requieren credenciales válidas (rut/username y password)' 
        });
      }

      // Crear tarea de scraping
      const task = await this.scraperService.createTask(taskData);

      return res.status(202).json({
        message: 'Tarea de scraping iniciada',
        task: {
          id: task.id,
          status: task.status,
          createdAt: task.createdAt,
          type: task.type,
          site: task.site
        }
      });
    } catch (error) {
      if (error instanceof DatabaseError) {
        return res.status(400).json({ message: error.message });
      }
      console.error('Error en startScraping:', error);
      return res.status(500).json({ message: 'Error interno del servidor' });
    }
  };

  /**
   * Inicia una tarea específica para obtener saldos
   */
  public startSaldosScraping = async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      // Verificar que el usuario está autenticado
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      // Obtener datos del cuerpo de la solicitud
      const credentials = req.body;

      // Validar datos básicos
      if ((!credentials.rut && !credentials.username) || !credentials.password) {
        return res.status(400).json({ 
          message: 'Se requieren credenciales válidas (rut/username y password)' 
        });
      }

      // Crear tarea de scraping específica para saldos
      const taskData: IScraperTaskCreate = {
        credentials,
        type: 'saldos',
        site: 'banco_estado'
      };

      const task = await this.scraperService.createTask(taskData);

      return res.status(202).json({
        message: 'Tarea de obtención de saldos iniciada',
        task: {
          id: task.id,
          status: task.status,
          createdAt: task.createdAt,
          type: task.type
        }
      });
    } catch (error) {
      if (error instanceof DatabaseError) {
        return res.status(400).json({ message: error.message });
      }
      console.error('Error en startSaldosScraping:', error);
      return res.status(500).json({ message: 'Error interno del servidor' });
    }
  };

  /**
   * Inicia una tarea específica para obtener movimientos recientes
   */
  public startMovimientosRecientesScraping = async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      // Verificar que el usuario está autenticado
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      // Obtener datos del cuerpo de la solicitud
      const credentials = req.body;

      // Validar datos básicos
      if ((!credentials.rut && !credentials.username) || !credentials.password) {
        return res.status(400).json({ 
          message: 'Se requieren credenciales válidas (rut/username y password)' 
        });
      }

      // Crear tarea de scraping específica para movimientos recientes
      const taskData: IScraperTaskCreate = {
        credentials,
        type: 'movimientos_recientes',
        site: 'banco_estado'
      };

      const task = await this.scraperService.createTask(taskData);

      return res.status(202).json({
        message: 'Tarea de obtención de movimientos recientes iniciada',
        task: {
          id: task.id,
          status: task.status,
          createdAt: task.createdAt,
          type: task.type
        }
      });
    } catch (error) {
      if (error instanceof DatabaseError) {
        return res.status(400).json({ message: error.message });
      }
      console.error('Error en startMovimientosRecientesScraping:', error);
      return res.status(500).json({ message: 'Error interno del servidor' });
    }
  };

  /**
   * Obtiene el estado de una tarea específica
   */
  public getTaskStatus = async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      // Verificar que el usuario está autenticado
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const taskId = req.params.taskId;
      if (!taskId) {
        return res.status(400).json({ message: 'Se requiere ID de tarea' });
      }

      // Obtener tarea
      const task = this.scraperService.getTask(taskId);
      if (!task) {
        return res.status(404).json({ message: 'Tarea no encontrada' });
      }

      // Si la tarea está completada, devolver también el resultado
      if (task.status === 'completed' || task.status === 'failed') {
        return res.status(200).json({
          id: task.id,
          status: task.status,
          createdAt: task.createdAt,
          result: task.result || null,
          error: task.error || null,
          type: task.type
        });
      }

      // Si la tarea está en proceso, devolver solo el estado
      return res.status(200).json({
        id: task.id,
        status: task.status,
        createdAt: task.createdAt,
        type: task.type
      });
    } catch (error) {
      console.error('Error en getTaskStatus:', error);
      return res.status(500).json({ message: 'Error interno del servidor' });
    }
  };

  /**
   * Obtiene el estado general del scraper
   */
  public getScraperStatus = async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      // Verificar que el usuario está autenticado
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const status = this.scraperService.getStatus();
      return res.status(200).json(status);
    } catch (error) {
      console.error('Error en getScraperStatus:', error);
      return res.status(500).json({ message: 'Error interno del servidor' });
    }
  };

  /**
   * Obtiene todas las tareas activas
   */
  public getAllTasks = async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      // Verificar que el usuario está autenticado
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const tasks = this.scraperService.getAllTasks();
      // No devolver las credenciales por seguridad
      const sanitizedTasks = tasks.map(task => ({
        id: task.id,
        status: task.status,
        createdAt: task.createdAt,
        hasResult: task.status === 'completed' || task.status === 'failed',
        type: task.type || 'default',
        site: task.site || 'banco_estado'
      }));

      return res.status(200).json(sanitizedTasks);
    } catch (error) {
      console.error('Error en getAllTasks:', error);
      return res.status(500).json({ message: 'Error interno del servidor' });
    }
  };

  /**
   * Limpia las tareas antiguas
   */
  public cleanupTasks = async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      // Verificar que el usuario está autenticado y es admin
      const userId = req.user?.id;
      const userRole = req.user?.role;
      
      if (!userId || userRole !== 'admin') {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      // Obtener edad máxima de tareas (en horas)
      const maxAgeHours = req.body.maxAgeHours || 24;
      const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
      
      const cleanedCount = this.scraperService.cleanupOldTasks(maxAgeMs);
      return res.status(200).json({ 
        message: `Se eliminaron ${cleanedCount} tareas antiguas`,
        cleanedCount
      });
    } catch (error) {
      console.error('Error en cleanupTasks:', error);
      return res.status(500).json({ message: 'Error interno del servidor' });
    }
  };
} 