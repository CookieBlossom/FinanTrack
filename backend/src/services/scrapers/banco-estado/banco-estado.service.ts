import { Injectable } from '@nestjs/common';
import { RedisService } from '../../redis.service';
import { ScraperService, ScraperTask } from '../scraper.service';
import { spawn } from 'child_process';
import { join } from 'path';
import { WebSocketService } from '../../websocket.service';
import { ScraperEvent, TaskStatus } from '../../../interfaces/ScraperEvent';
import { getErrorMessage, ScraperError } from '../../../utils/errors';

@Injectable()
export class BancoEstadoService {
    private wsService: WebSocketService;

    constructor(
        private readonly redisService: RedisService,
        private readonly scraperService: ScraperService,
    ) {
        this.wsService = WebSocketService.getInstance();
    }

    private async emitEvent(taskId: string, event: ScraperEvent): Promise<void> {
        try {
            const status: TaskStatus = {
                id: taskId,
                status: event.type,
                progress: event.progress,
                message: event.message,
                error: event.error,
                result: event.result,
                updatedAt: new Date().toISOString()
            };
            await this.wsService.updateTaskStatus(taskId, status);
        } catch (err: unknown) {
            console.error(`Error al emitir evento para tarea ${taskId}:`, getErrorMessage(err));
        }
    }

    async executeScraperTask(userId: number, credentials: { rut: string; password: string; planId: number }): Promise<{ taskId: string }> {
        try {
            const task = await this.scraperService.createTask({
                userId,
                type: 'banco-estado',
                data: credentials,
                planId: credentials.planId
            });

            await this.emitEvent(task.id, {
                type: 'processing',
                progress: 0,
                message: 'Iniciando proceso de scraping...'
            });

            const taskData = {
                id: task.id,
                user_id: Number(userId),
                type: 'banco-estado',
                status: 'processing',
                message: 'Iniciando proceso de scraping...',
                progress: 0.0,
                result: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                error: null,
                data: {
                    rut: credentials.rut,
                    password: credentials.password
                }
            };

            await this.redisService.hSet(`scraper:tasks:${task.id}`, 'data', JSON.stringify(taskData));
            const taskKey = `scraper:tasks:${task.id}`;

            const listener = async (channel: string, message: string) => {
                try {
                    const updatedTask = JSON.parse(message);
                    await this.emitEvent(task.id, {
                        type: updatedTask.status as ScraperEvent['type'],
                        progress: updatedTask.progress * 100,
                        message: updatedTask.message,
                        error: updatedTask.error,
                        result: updatedTask.result
                    });
                } catch (err: unknown) {
                    console.error('Error procesando actualización de tarea:', getErrorMessage(err));
                }
            };

            await this.redisService.subscribe(`${taskKey}:updates`, listener);
            await this.redisService.rpush('scraper:queue', JSON.stringify(taskData));
            this.runScraper();

            return { taskId: task.id };
        } catch (err: unknown) {
            console.error('[BancoEstadoService] Error al crear tarea de scraping:', err);
            throw new ScraperError(getErrorMessage(err));
        }
    }

    async getTaskStatus(taskId: string): Promise<ScraperTask | null> {
        try {
            const scraperTaskData = await this.redisService.hGet(`scraper:tasks:${taskId}`, 'data');
            
            if (scraperTaskData) {
                const scraperTask = JSON.parse(scraperTaskData);
                const transformedResult = this.transformScraperResult(scraperTask.result);
                const task = {
                    id: taskId,
                    userId: scraperTask.user_id || 0,
                    type: scraperTask.type,
                    status: scraperTask.status,
                    message: scraperTask.message,
                    progress: scraperTask.progress || 0,
                    result: transformedResult,
                    createdAt: scraperTask.createdAt || new Date().toISOString(),
                    updatedAt: scraperTask.updatedAt || new Date().toISOString(),
                    error: scraperTask.error
                };
                
                return task;
            }

            return this.scraperService.getTask(taskId);
        } catch (err: unknown) {
            console.error('[BancoEstadoService] Error al obtener estado de tarea:', getErrorMessage(err));
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

            await this.redisService.rpush('scraper:control', JSON.stringify({
                action: 'cancel',
                id: taskId
            }));

            return { success: true, message: 'Tarea cancelada exitosamente', taskId };
        } catch (err: unknown) {
            console.error('[BancoEstadoService] Error al cancelar tarea:', getErrorMessage(err));
            return { 
                success: false, 
                message: getErrorMessage(err), 
                taskId 
            };
        }
    }

    async runScraper(config: any = {}): Promise<void> {
        try {
            // Encontrar la raíz del proyecto
            const currentDir = process.cwd();
            console.log('currentDir:', currentDir);
            
            // Asumiendo que estamos en /backend, subimos un nivel
            const projectRoot = join(currentDir, '..');
            console.log('projectRoot:', projectRoot);
            
            const scriptPath = join(projectRoot, 'scraper', 'sites', 'banco_estado', 'banco_estado_manager.py');
            console.log('scriptPath:', scriptPath);
            
            // Verificar que el archivo existe
            const fs = require('fs');
            if (!fs.existsSync(scriptPath)) {
                console.error(`[BancoEstadoService] ERROR: El script no existe en: ${scriptPath}`);
                throw new Error(`Script no encontrado en: ${scriptPath}`);
            }
            
            // Intentar diferentes comandos de Python comunes en Windows
            const pythonCommands = ['py', 'python', 'python3'];
            let pythonPath = null;
            
            for (const cmd of pythonCommands) {
                try {
                    const { execSync } = require('child_process');
                    execSync(`${cmd} --version`, { stdio: 'pipe' });
                    pythonPath = cmd;
                    break;
                } catch (err) {
                    console.log(`Comando ${cmd} no disponible:`, getErrorMessage(err));
                }
            }
            
            if (!pythonPath) {
                throw new Error('No se encontró Python instalado. Instala Python o verifica el PATH.');
            }

            console.log('Variables de entorno para el scraper:', {
                REDIS_URL: process.env.REDIS_URL,
                REDIS_HOST: process.env.REDIS_HOST,
                REDIS_PORT: process.env.REDIS_PORT,
                BACKEND_URL: process.env.BACKEND_URL
            });

            const scraperProcess = spawn(pythonPath, [scriptPath], {
                env: {
                    ...process.env,
                    REDIS_URL: process.env.REDIS_URL,
                    REDIS_HOST: process.env.REDIS_HOST || config.redis.url.split('@')[1]?.split(':')[0] || 'localhost',
                    REDIS_PORT: process.env.REDIS_PORT || config.redis.url.split(':')[1]?.split('/')[0] || '6379',
                    BACKEND_URL: process.env.BACKEND_URL || 'http://localhost:3000',
                    PYTHONPATH: join(projectRoot, 'scraper')
                },
                cwd: join(projectRoot, 'scraper', 'sites', 'banco_estado')
            });

            scraperProcess.stdout.on('data', (data) => {
                console.log(`[BancoEstado Scraper] ${data}`);
            });

            scraperProcess.stderr.on('data', (data) => {
                console.error(`[BancoEstado Scraper] Error: ${data}`);
            });

            scraperProcess.on('close', (code) => {
                console.log(`[BancoEstado Scraper] Proceso terminado con código: ${code}`);
            });

            scraperProcess.on('error', (error) => {
                console.error(`[BancoEstado Scraper] Error al iniciar proceso:`, error);
            });
        } catch (err: unknown) {
            console.error('[BancoEstado Scraper] Error al ejecutar scraper:', getErrorMessage(err));
            throw new ScraperError(getErrorMessage(err));
        }
    }

    async startScraping(taskId: string, credentials: any): Promise<void> {
        try {
            await this.emitEvent(taskId, {
                type: 'processing',
                progress: 0,
                message: 'Iniciando proceso de scraping...'
            });

            // Proceso de login
            await this.emitEvent(taskId, {
                type: 'processing',
                progress: 20,
                message: 'Iniciando sesión en Banco Estado...'
            });

            // Navegación y extracción
            await this.emitEvent(taskId, {
                type: 'processing',
                progress: 40,
                message: 'Navegando a la sección de movimientos...'
            });

            // Descarga de datos
            await this.emitEvent(taskId, {
                type: 'processing',
                progress: 60,
                message: 'Descargando movimientos...'
            });

            // Procesamiento de datos
            await this.emitEvent(taskId, {
                type: 'processing',
                progress: 80,
                message: 'Procesando movimientos...'
            });

            // Finalización exitosa
            await this.emitEvent(taskId, {
                type: 'completed',
                progress: 100,
                message: 'Proceso completado exitosamente',
                result: {
                    // Aquí van los resultados del scraping
                }
            });

        } catch (err: unknown) {
            await this.emitEvent(taskId, {
                type: 'failed',
                progress: 0,
                message: 'Error durante el scraping',
                error: getErrorMessage(err)
            });
            throw new ScraperError(getErrorMessage(err));
        }
    }
} 