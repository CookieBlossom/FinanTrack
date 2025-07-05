"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScraperService = void 0;
const plan_service_1 = require("../plan.service");
const errors_1 = require("../../utils/errors");
// import { ConfigService } from '@nestjs/config'; // No se usa directamente, usamos process.env si es necesario
const uuid_1 = require("uuid");
// Cargar dotenv para asegurar que process.env esté poblado
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// @Injectable() // No es necesario para Express
class ScraperService {
    constructor(redisService) {
        this.redisService = redisService;
        this.planService = new plan_service_1.PlanService();
    }
    // Verificar límites de uso del scraper
    async checkScraperLimits(userId, planId) {
        const limits = await this.planService.getLimitsForPlan(planId);
        const maxScrapes = limits.monthly_scrapes || 0; // Por defecto 0 si no está definido
        if (maxScrapes === -1) {
            return; // Ilimitado
        }
        const currentMonth = new Date();
        const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
        const tasks = await this.getAllTasks(userId);
        const monthlyTasks = tasks.filter(task => new Date(task.createdAt) >= startOfMonth);
        if (monthlyTasks.length >= maxScrapes) {
            throw new errors_1.DatabaseError(`Has alcanzado el límite de ${maxScrapes} sincronizaciones por mes para tu plan.`);
        }
    }
    // Verificar permisos del scraper
    async checkScraperPermission(planId) {
        const hasPermission = await this.planService.hasPermission(planId, 'scraper_access');
        if (!hasPermission) {
            throw new errors_1.DatabaseError('Tu plan no incluye la funcionalidad de sincronización automática.');
        }
    }
    async createTask(data) {
        // Verificar permisos y límites antes de crear la tarea
        await this.checkScraperPermission(data.planId);
        await this.checkScraperLimits(data.userId, data.planId);
        const taskId = (0, uuid_1.v4)();
        const task = {
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
    async getTask(taskId) {
        const taskData = await this.redisService.get(`task:${taskId}`);
        if (!taskData)
            return null;
        return JSON.parse(taskData);
    }
    async getAllTasks(userId) {
        const keys = await this.redisService.keys('task:*');
        const tasks = [];
        for (const key of keys) {
            const taskData = await this.redisService.get(key);
            if (taskData) {
                const task = JSON.parse(taskData);
                if (task.userId === userId) {
                    tasks.push(task);
                }
            }
        }
        return tasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    async updateTask(taskId, update) {
        const taskData = await this.redisService.get(`task:${taskId}`);
        if (!taskData) {
            throw new Error('Tarea no encontrada');
        }
        const task = JSON.parse(taskData);
        const updatedTask = {
            ...task,
            ...update,
            updatedAt: new Date().toISOString()
        };
        await this.redisService.set(`task:${taskId}`, JSON.stringify(updatedTask));
        return updatedTask;
    }
    async cleanupOldTasks(maxAgeHours = 48) {
        const keys = await this.redisService.keys('task:*');
        const now = new Date().getTime();
        let deletedCount = 0;
        for (const key of keys) {
            const taskData = await this.redisService.get(key);
            if (taskData) {
                const task = JSON.parse(taskData);
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
    async getStatus() {
        const keys = await this.redisService.keys('task:*');
        const tasks = [];
        const errors = [];
        let lastSync = new Date(0);
        for (const key of keys) {
            const taskData = await this.redisService.get(key);
            if (taskData) {
                const task = JSON.parse(taskData);
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
        const activeTasks = tasks.filter(t => ['pending', 'processing'].includes(t.status)).length;
        return {
            isRunning: activeTasks > 0,
            activeTasks,
            lastSync,
            errors: errors.slice(-10) // Mantener solo los últimos 10 errores
        };
    }
}
exports.ScraperService = ScraperService;
//# sourceMappingURL=scraper.service.js.map