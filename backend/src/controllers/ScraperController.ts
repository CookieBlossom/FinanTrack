import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../interfaces/AuthRequest';
import { validateRut } from '../utils/validators';
import { BancoEstadoService } from '../services/scrapers/banco-estado/banco-estado.service';
import { RedisService } from '../services/redis.service';
import { ScraperService } from '../services/scrapers/scraper.service';

// Cargar dotenv para asegurar que process.env esté poblado
import dotenv from 'dotenv';
dotenv.config();

export class ScraperController {
  private bancoEstadoService: BancoEstadoService;

  constructor() {
    const redisService = new RedisService();
    const scraperService = new ScraperService(redisService);
    this.bancoEstadoService = new BancoEstadoService(redisService, scraperService);
  }

  /**
   * Crea una nueva tarea de scraping para Banco Estado
   */
  public createTask = async (req: Request, res: Response, next: NextFunction): Promise<Response> => {
    try {
      const user = (req as AuthRequest).user;
      if (!user) {
        return res.status(401).json({ success: false, message: 'Usuario no autorizado' });
      }

      console.log('Body recibido:', {
        ...req.body,
        password: '****'
      });

      const { rut, password, site } = req.body;

      // Validaciones
      if (!rut || typeof rut !== 'string') {
        console.log('Error: RUT inválido o faltante', { rut });
        return res.status(400).json({ success: false, message: 'El campo rut es requerido y debe ser un string.' });
      }
      if (!password || typeof password !== 'string') {
        console.log('Error: Password inválido o faltante');
        return res.status(400).json({ success: false, message: 'El campo password es requerido y debe ser un string.' });
      }
      if (!site || typeof site !== 'string') {
        console.log('Error: Site inválido o faltante', { site });
        return res.status(400).json({ success: false, message: 'El campo site es requerido y debe ser un string.' });
      }
      if (!validateRut(rut)) {
        console.log('Error: Formato de RUT inválido', { rut });
        return res.status(400).json({ success: false, message: 'El formato del RUT es inválido.' });
      }
      if (password.length < 4) { 
        console.log('Error: Contraseña muy corta');
        return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 4 caracteres.' });
      }
      
      const supportedSites = ['banco-estado'];
      if (!supportedSites.includes(site.toLowerCase())) {
        console.log('Error: Sitio no soportado', { site });
        return res.status(400).json({ success: false, message: `El sitio '${site}' no está soportado. Sitios soportados: ${supportedSites.join(', ')}` });
      }

      let taskResponse;
      if (site.toLowerCase() === 'banco-estado') {
        console.log('Ejecutando tarea para Banco Estado');
        taskResponse = await this.bancoEstadoService.executeScraperTask(user.id, { rut, password, planId: user.planId });
        console.log('Respuesta de la tarea:', { taskId: taskResponse?.taskId });
      } else {
        console.warn(`[ScraperController] Intento de crear tarea para sitio no implementado: ${site}`);
        return res.status(501).json({ success: false, message: `El scraping para el sitio '${site}' no está implementado.` });
      }
      
      return res.status(201).json({
        success: true,
        message: `Tarea de scraping para ${site} iniciada exitosamente.`,
        data: taskResponse,
      });

    } catch (error) {
      console.error('[ScraperController] Error en createTask:', error);
      const message = error instanceof Error ? error.message : 'Error interno del servidor al crear la tarea.';
      const statusCode = error instanceof Error && 'status' in error ? (error as any).status : 500;
      return res.status(statusCode).json({ success: false, message });
    }
  };

  /**
   * Obtiene el estado de una tarea específica
   */
  public getTaskStatus = async (req: Request, res: Response, next: NextFunction): Promise<Response> => {
    try {
      const userId = (req as AuthRequest).user?.id; 
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Usuario no autorizado' });
      }
      const { taskId } = req.params;
      if (!taskId) {
        return res.status(400).json({ success: false, message: 'El taskId es requerido en los parámetros de la URL.' });
      }

      const task = await this.bancoEstadoService.getTaskStatus(taskId);
      if (!task) {
        return res.status(404).json({ success: false, message: 'Tarea no encontrada.' });
      }

      return res.json({ success: true, data: task });

    } catch (error) {
      console.error('[ScraperController] Error en getTaskStatus:', error);
      const message = error instanceof Error ? error.message : 'Error interno del servidor al obtener la tarea.';
      const statusCode = error instanceof Error && 'status' in error ? (error as any).status : 500;
      return res.status(statusCode).json({ success: false, message });
    }
  };

  /**
   * Cancela una tarea específica
   */
  public cancelTask = async (req: Request, res: Response, next: NextFunction): Promise<Response> => {
    try {
      const userId = (req as AuthRequest).user?.id; 
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Usuario no autorizado' });
      }
      const { taskId } = req.params;
      if (!taskId) {
        return res.status(400).json({ success: false, message: 'El taskId es requerido en los parámetros de la URL.' });
      }

      const result = await this.bancoEstadoService.cancelTask(taskId);
      
      if (!result.success) {
        const statusCode = result.message === 'Tarea no encontrada' ? 404 : 400;
        return res.status(statusCode).json({ success: false, message: result.message, taskId: result.taskId });
      }

      return res.json({ 
        success: true, 
        message: result.message || 'Solicitud de cancelación procesada.', 
        data: { taskId: result.taskId } 
      });

    } catch (error) {
      console.error('[ScraperController] Error en cancelTask:', error);
      const message = error instanceof Error ? error.message : 'Error interno del servidor al cancelar la tarea.';
      const statusCode = error instanceof Error && 'status' in error ? (error as any).status : 500;
      return res.status(statusCode).json({ success: false, message });
    }
  };
} 