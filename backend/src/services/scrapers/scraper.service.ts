// import { Injectable } from '@nestjs/common'; // No es necesario para Express
import { RedisService } from '../redis.service';
import { PlanService } from '../plan.service';
import { DatabaseError } from '../../utils/errors';
// import { ConfigService } from '@nestjs/config'; // No se usa directamente, usamos process.env si es necesario
import { v4 as uuidv4 } from 'uuid';

// Cargar dotenv para asegurar que process.env esté poblado
import dotenv from 'dotenv';
dotenv.config();

export interface ScraperTask {
  id: string;
  userId: number;
  type: string;
  data?: any;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  message?: string;
  progress: number;
  result?: any;
  createdAt: string;
  updatedAt: string;
  error?: string;
}

// @Injectable() // No es necesario para Express
export class ScraperService {
  private planService: PlanService;

  constructor(
    private readonly redisService: RedisService,
    // private readonly configService: ConfigService // Quitar si no se usa directamente aquí
  ) {
    this.planService = new PlanService();
  }

  // Verificar límites de uso del scraper
  private async checkScraperLimits(userId: number, planId: number): Promise<void> {
    const limits = await this.planService.getLimitsForPlan(planId);
    const maxScrapes = limits.monthly_scrapes || 0; // Por defecto 0 si no está definido

    if (maxScrapes === -1) {
      return; // Ilimitado
    }

    const currentMonth = new Date();
    const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    
    const tasks = await this.getAllTasks(userId);
    const monthlyTasks = tasks.filter(task => 
      new Date(task.createdAt) >= startOfMonth
    );

    if (monthlyTasks.length >= maxScrapes) {
      throw new DatabaseError(`Has alcanzado el límite de ${maxScrapes} sincronizaciones por mes para tu plan.`);
    }
  }

  // Verificar permisos del scraper
  private async checkScraperPermission(planId: number): Promise<void> {
    const hasPermission = await this.planService.hasPermission(planId, 'scraper_access');
    if (!hasPermission) {
      throw new DatabaseError('Tu plan no incluye la funcionalidad de sincronización automática.');
    }
  }

  async createTask(data: { userId: number; type: string; data?: any; planId: number }): Promise<ScraperTask> {
    // Verificar permisos y límites antes de crear la tarea
    await this.checkScraperPermission(data.planId);
    await this.checkScraperLimits(data.userId, data.planId);

    const taskId = uuidv4();
    const task: ScraperTask = {
      id: taskId,
      userId: data.userId,
      type: data.type,
      data: data.data,
      status: 'pending',
      progress: 0,
      message: 'Tarea creada, esperando procesamiento',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await this.redisService.set(`task:${taskId}`, JSON.stringify(task));
    return task;
  }

  async getTask(taskId: string): Promise<ScraperTask | null> {
    const taskData = await this.redisService.get(`task:${taskId}`);
    if (!taskData) return null;
    return JSON.parse(taskData);
  }

  async getAllTasks(userId: number): Promise<ScraperTask[]> {
    const keys = await this.redisService.keys('task:*');
    const tasks: ScraperTask[] = [];
    
    for (const key of keys) {
      const taskData = await this.redisService.get(key);
      if (taskData) {
        const task: ScraperTask = JSON.parse(taskData);
        if (task.userId === userId) {
          tasks.push(task);
        }
      }
    }
    
    return tasks.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async updateTask(taskId: string, update: Partial<ScraperTask>): Promise<ScraperTask> {
    const taskData = await this.redisService.get(`task:${taskId}`);
    if (!taskData) {
      throw new Error('Tarea no encontrada');
    }

    const task: ScraperTask = JSON.parse(taskData);
    const updatedTask: ScraperTask = {
      ...task,
      ...update,
      updatedAt: new Date().toISOString()
    };

    await this.redisService.set(`task:${taskId}`, JSON.stringify(updatedTask));
    return updatedTask;
  }

  async cleanupOldTasks(maxAgeHours: number = 48): Promise<number> {
    const keys = await this.redisService.keys('task:*');
    const now = new Date().getTime();
    let deletedCount = 0;

    for (const key of keys) {
      const taskData = await this.redisService.get(key);
      if (taskData) {
        const task: ScraperTask = JSON.parse(taskData);
        const taskAge = now - new Date(task.updatedAt).getTime();
        const maxAge = maxAgeHours * 60 * 60 * 1000;
        
        if (taskAge > maxAge && ['completed', 'failed', 'cancelled'].includes(task.status)) {
          await this.redisService.del(key);
          deletedCount++;
        }
      }
    }

    return deletedCount;
  }

  async getStatus(): Promise<{
    isRunning: boolean;
    activeTasks: number;
    lastSync: Date;
    errors: string[];
  }> {
    const keys = await this.redisService.keys('task:*');
    const tasks: ScraperTask[] = [];
    const errors: string[] = [];
    let lastSync = new Date(0);
    
    for (const key of keys) {
      const taskData = await this.redisService.get(key);
      if (taskData) {
        const task: ScraperTask = JSON.parse(taskData);
        tasks.push(task);
        
        if (task.status === 'failed' && task.error) {
          errors.push(task.error);
        }
        
        if (task.status === 'completed') {
          const taskDate = new Date(task.updatedAt);
          if (taskDate > lastSync) {
            lastSync = taskDate;
          }
        }
      }
    }
    
    const activeTasks = tasks.filter(t => 
      ['pending', 'processing'].includes(t.status)
    ).length;
    
    return {
      isRunning: activeTasks > 0,
      activeTasks,
      lastSync,
      errors: errors.slice(-10) // Mantener solo los últimos 10 errores
    };
  }
} 