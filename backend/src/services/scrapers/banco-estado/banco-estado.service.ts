import { Injectable } from '@nestjs/common';
import { RedisService } from '../../redis.service';
import { ScraperService, ScraperTask } from '../scraper.service';
import { spawn } from 'child_process';
import { join } from 'path';

@Injectable()
export class BancoEstadoService {
    constructor(
        private readonly redisService: RedisService,
        private readonly scraperService: ScraperService,
    ) {}

    async executeScraperTask(userId: number, credentials: { rut: string; password: string }): Promise<{ taskId: string }> {
        try {
            // Crear la tarea usando el ScraperService
            const task = await this.scraperService.createTask({
                userId,
                type: 'banco-estado',
                data: credentials
            });

            // Crear la tarea en Redis con el formato que espera el scraper
            // Asegurarnos de que los tipos coincidan con el modelo Python
            const taskData = {
                id: task.id,
                user_id: Number(userId), // Asegurar que sea número
                type: 'banco-estado',
                status: 'pending',
                message: 'Tarea creada',
                progress: 0.0, // Float en Python
                result: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                error: null,
                data: {
                    rut: credentials.rut,
                    password: credentials.password
                }
            };

            // Guardar la tarea en Redis con el formato que espera el scraper
            await this.redisService.hSet(`scraper:tasks:${task.id}`, 'data', JSON.stringify(taskData));

            // Agregar la tarea a la cola de procesamiento
            await this.redisService.rpush('scraper:queue', JSON.stringify(taskData));

            return { taskId: task.id };
        } catch (error) {
            console.error('[BancoEstadoService] Error al crear tarea de scraping:', error);
            throw new Error('Error al iniciar el proceso de scraping para Banco Estado');
        }
    }

    async getTaskStatus(taskId: string): Promise<ScraperTask | null> {
        try {
            // Intentar obtener el estado del formato del scraper primero
            const scraperTaskData = await this.redisService.hGet(`scraper:tasks:${taskId}`, 'data');
            if (scraperTaskData) {
                const scraperTask = JSON.parse(scraperTaskData);
                // Convertir el formato del scraper al formato del servicio
                const transformedResult = this.transformScraperResult(scraperTask.result);
                return {
                    id: taskId,
                    userId: scraperTask.userId || 0,
                    type: scraperTask.type,
                    status: scraperTask.status,
                    message: scraperTask.message,
                    progress: scraperTask.progress || 0,
                    result: transformedResult,
                    createdAt: scraperTask.createdAt || new Date().toISOString(),
                    updatedAt: scraperTask.updatedAt || new Date().toISOString(),
                    error: scraperTask.error
                };
            }

            // Si no se encuentra en el formato del scraper, intentar el formato del servicio
            return this.scraperService.getTask(taskId);
        } catch (error) {
            console.error('[BancoEstadoService] Error al obtener estado de tarea:', error);
            return null;
        }
    }

    private transformScraperResult(result: any): any {
        if (!result) return null;

        // Transformar las cuentas al formato esperado por el frontend
        const cards = result.cuentas?.map((cuenta: any) => ({
            number: cuenta.numero,
            type: cuenta.tipo,
            bank: 'BancoEstado',
            balance: cuenta.saldo,
            lastFourDigits: cuenta.numero.slice(-4),
            movements: cuenta.movimientos,
            status: cuenta.estado
        })) || [];

        return {
            success: result.success,
            message: result.message,
            cards: cards,
            ultimos_movimientos: result.ultimos_movimientos,
            metadata: result.metadata
        };
    }

    async cancelTask(taskId: string): Promise<{ success: boolean; message: string; taskId: string }> {
        try {
            const task = await this.getTaskStatus(taskId);
            if (!task) {
                return { success: false, message: 'Tarea no encontrada', taskId };
            }

            if (['completed', 'failed', 'cancelled'].includes(task.status)) {
                return { 
                    success: false, 
                    message: 'No se puede cancelar una tarea que ya finalizó o fue cancelada', 
                    taskId 
                };
            }

            // Enviar señal de cancelación al scraper
            await this.redisService.rpush('scraper:control', JSON.stringify({
                action: 'cancel',
                id: taskId
            }));

            return { success: true, message: 'Tarea cancelada exitosamente', taskId };
        } catch (error) {
            console.error('[BancoEstadoService] Error al cancelar tarea:', error);
            return { 
                success: false, 
                message: error instanceof Error ? error.message : 'Error interno al cancelar la tarea', 
                taskId 
            };
        }
    }

    async runScraper(config: any = {}): Promise<void> {
        // Encontrar la raíz del proyecto
        const projectRoot = process.cwd();
        const pythonPath = 'python';
        const scriptPath = join(projectRoot, 'scraper', 'sites', 'banco_estado', 'banco_estado_manager.py');

        console.log(`[BancoEstado Scraper] Iniciando scraper desde: ${scriptPath}`);

        const scraperProcess = spawn(pythonPath, [scriptPath], {
            env: {
                ...process.env,
                REDIS_HOST: config.redisHost || 'localhost',
                REDIS_PORT: config.redisPort || '6379',
                PYTHONPATH: join(projectRoot, 'scraper')
            },
            cwd: join(projectRoot, 'scraper', 'sites', 'banco_estado')
        });

        scraperProcess.stdout.on('data', (data) => {
            console.log(`[BancoEstado Scraper] ${data}`);
        });

        scraperProcess.stderr.on('data', (data) => {
            console.error(`[BancoEstado Scraper Error] ${data}`);
        });

        scraperProcess.on('close', (code) => {
            console.log(`[BancoEstado Scraper] Proceso terminado con código ${code}`);
        });

        scraperProcess.on('error', (error) => {
            console.error(`[BancoEstado Scraper] Error al iniciar proceso: ${error}`);
        });
    }
} 