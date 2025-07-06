"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScraperController = void 0;
const validators_1 = require("../utils/validators");
const banco_estado_service_1 = require("../services/scrapers/banco-estado/banco-estado.service");
const redis_service_1 = require("../services/redis.service");
const scraper_service_1 = require("../services/scrapers/scraper.service");
const plan_service_1 = require("../services/plan.service");
const card_service_1 = require("../services/card.service");
const user_service_1 = require("../services/user.service");
const movement_service_1 = require("../services/movement.service");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
class ScraperController {
    constructor() {
        this.createTask = async (req, res, next) => {
            try {
                const user = req.user;
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
                if (!(0, validators_1.validateRut)(rut)) {
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
                }
                else {
                    console.warn(`[ScraperController] Intento de crear tarea para sitio no implementado: ${site}`);
                    return res.status(501).json({ success: false, message: `El scraping para el sitio '${site}' no está implementado.` });
                }
                return res.status(201).json({
                    success: true,
                    message: `Tarea de scraping para ${site} iniciada exitosamente.`,
                    data: taskResponse,
                });
            }
            catch (error) {
                console.error('[ScraperController] Error en createTask:', error);
                const message = error instanceof Error ? error.message : 'Error interno del servidor al crear la tarea.';
                const statusCode = error instanceof Error && 'status' in error ? error.status : 500;
                return res.status(statusCode).json({ success: false, message });
            }
        };
        this.getTaskStatus = async (req, res, next) => {
            try {
                const userId = req.user?.id;
                if (!userId) {
                    return res.status(401).json({ success: false, message: 'Usuario no autorizado' });
                }
                const { taskId } = req.params;
                if (!taskId) {
                    return res.status(400).json({ success: false, message: 'El taskId es requerido en los parámetros de la URL.' });
                }
                console.log(' BACKEND - Consultando estado de tarea:', taskId);
                const task = await this.bancoEstadoService.getTaskStatus(taskId);
                console.log(' BACKEND - Tarea obtenida:', task);
                if (!task) {
                    console.log(' BACKEND - Tarea no encontrada:', taskId);
                    return res.status(404).json({ success: false, message: 'Tarea no encontrada.' });
                }
                return res.json({ success: true, data: task });
            }
            catch (error) {
                console.error('[ScraperController] Error en getTaskStatus:', error);
                const message = error instanceof Error ? error.message : 'Error interno del servidor al obtener la tarea.';
                const statusCode = error instanceof Error && 'status' in error ? error.status : 500;
                return res.status(statusCode).json({ success: false, message });
            }
        };
        /**
         * Cancela una tarea específica
         */
        this.cancelTask = async (req, res, next) => {
            try {
                const userId = req.user?.id;
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
            }
            catch (error) {
                console.error('[ScraperController] Error en cancelTask:', error);
                const message = error instanceof Error ? error.message : 'Error interno del servidor al cancelar la tarea.';
                const statusCode = error instanceof Error && 'status' in error ? error.status : 500;
                return res.status(statusCode).json({ success: false, message });
            }
        };
        /**
         * Obtiene el historial de tareas del usuario
         */
        this.getUserTasks = async (req, res, next) => {
            try {
                const userId = req.user?.id;
                if (!userId) {
                    return res.status(401).json({ success: false, message: 'Usuario no autorizado' });
                }
                return res.json({
                    success: true,
                    data: [], // Temporal hasta implementar
                    message: 'Funcionalidad en desarrollo'
                });
            }
            catch (error) {
                console.error('[ScraperController] Error al obtener tareas:', error);
                const message = error instanceof Error ? error.message : 'Error interno del servidor al obtener las tareas.';
                return res.status(500).json({ success: false, message });
            }
        };
        this.processScraperData = async (req, res, next) => {
            let scraperTaskId;
            try {
                const { rawMovements, userId, scraperTaskId: taskId } = req.body;
                scraperTaskId = taskId;
                if (!Array.isArray(rawMovements) || typeof userId !== 'number' || typeof scraperTaskId !== 'string') {
                    return res.status(400).json({ message: 'Datos inválidos en el payload del scraper' });
                }
                if (userId === 0) {
                    return res.status(400).json({ message: 'userId no puede ser 0' });
                }
                console.log(`[ScraperController] Procesando ${rawMovements.length} movimientos del scraper para usuario ${userId}`);
                await this.updateScraperTaskStatus(scraperTaskId, {
                    status: 'processing',
                    message: `Procesando ${rawMovements.length} movimientos...`,
                    progress: 10
                });
                const cardService = new card_service_1.CardService();
                const userService = new user_service_1.UserService();
                const movementService = new movement_service_1.MovementService();
                // Obtener o crear tarjeta "Efectivo" para el usuario
                let defaultCard = await cardService.getCardsByUserId(userId);
                // Obtener el plan real del usuario desde la base de datos
                const user = await userService.getUserById(userId);
                if (!user) {
                    return res.status(404).json({ message: 'Usuario no encontrado' });
                }
                const planId = user.plan_id;
                console.log(`[ScraperController] Usuario ${userId} tiene plan ID ${planId}`);
                let defaultCardId;
                if (defaultCard.length === 0) {
                    const newCard = await cardService.createCard({
                        nameAccount: 'Efectivo - BancoEstado',
                        accountHolder: 'Usuario Scraper',
                        cardTypeId: 1,
                        balance: 0,
                        balanceSource: 'manual',
                        source: 'scraper'
                    }, userId, planId);
                    defaultCardId = newCard.id;
                    console.log(`[ScraperController] Tarjeta "Efectivo" creada automáticamente con ID ${defaultCardId}`);
                }
                else {
                    defaultCardId = defaultCard[0].id;
                    console.log(`[ScraperController] Usando tarjeta existente ID ${defaultCardId}: ${defaultCard[0].nameAccount}`);
                }
                const createdMovements = [];
                const errors = [];
                await this.updateScraperTaskStatus(scraperTaskId, {
                    status: 'processing',
                    message: 'Creando tarjetas y preparando datos...',
                    progress: 30
                });
                for (let i = 0; i < rawMovements.length; i++) {
                    const rawMov = rawMovements[i];
                    try {
                        const movementToCreate = await this.convertScraperMovement(rawMov, scraperTaskId, defaultCardId);
                        const newMovement = await movementService.createMovement(movementToCreate, userId, planId);
                        createdMovements.push(newMovement);
                        console.log(`[ScraperController] Movimiento creado: ${newMovement.description} - ${newMovement.amount}`);
                        if (i % 5 === 0 || i === rawMovements.length - 1) {
                            const progress = 30 + Math.round((i / rawMovements.length) * 60); // De 30% a 90%
                            await this.updateScraperTaskStatus(scraperTaskId, {
                                status: 'processing',
                                message: `Procesando movimientos: ${i + 1}/${rawMovements.length}`,
                                progress
                            });
                        }
                    }
                    catch (error) {
                        console.error(`[ScraperController] Error procesando movimiento:`, error);
                        errors.push({ rawMovement: rawMov, error: error instanceof Error ? error.message : 'Error desconocido' });
                    }
                }
                const stats = {
                    total_procesados: rawMovements.length,
                    exitosos: createdMovements.length,
                    errores: errors.length,
                    por_categoria: this.getMovementsByCategory(createdMovements)
                };
                console.log(`[ScraperController] Estadísticas del procesamiento del scraper:`, stats);
                if (errors.length > 0 && createdMovements.length > 0) {
                    await this.updateScraperTaskStatus(scraperTaskId, {
                        status: 'completed',
                        message: `Completado con ${createdMovements.length} movimientos procesados y ${errors.length} errores`,
                        progress: 100,
                        result: { createdMovements, errors, stats }
                    });
                    return res.status(207).json({
                        message: 'Procesamiento del scraper completado con algunos errores.',
                        createdMovements,
                        errors,
                        stats
                    });
                }
                else if (errors.length > 0) {
                    await this.updateScraperTaskStatus(scraperTaskId, {
                        status: 'failed',
                        message: `Error al procesar movimientos: ${errors.length} errores encontrados`,
                        progress: 100,
                        error: `${errors.length} movimientos fallaron`,
                        result: { errors, stats }
                    });
                    return res.status(400).json({
                        message: 'Error al procesar todos los movimientos del scraper.',
                        errors,
                        stats
                    });
                }
                else {
                    await this.updateScraperTaskStatus(scraperTaskId, {
                        status: 'completed',
                        message: ` ${createdMovements.length} movimientos procesados exitosamente`,
                        progress: 100,
                        result: { movements: createdMovements, stats }
                    });
                    return res.status(201).json({
                        message: 'Movimientos del scraper procesados exitosamente.',
                        movements: createdMovements,
                        stats
                    });
                }
            }
            catch (error) {
                console.error('Error general en processScraperData:', error);
                if (scraperTaskId) {
                    try {
                        await this.updateScraperTaskStatus(scraperTaskId, {
                            status: 'failed',
                            message: 'Error interno al procesar los datos del scraper',
                            progress: 0,
                            error: error instanceof Error ? error.message : 'Error desconocido'
                        });
                    }
                    catch (updateError) {
                        console.error('Error al actualizar estado de tarea:', updateError);
                    }
                }
                return res.status(500).json({ message: 'Error al procesar los datos del scraper' });
            }
        };
        const redisService = new redis_service_1.RedisService();
        const scraperService = new scraper_service_1.ScraperService(redisService);
        this.bancoEstadoService = new banco_estado_service_1.BancoEstadoService(redisService, scraperService);
        this.planService = new plan_service_1.PlanService();
    }
    async convertScraperMovement(mov, taskId, defaultCardId) {
        const categoryId = 1;
        return {
            description: mov.descripcion,
            amount: mov.monto,
            transactionDate: new Date(mov.fecha),
            movementType: mov.movement_type || (mov.monto > 0 ? 'income' : 'expense'),
            categoryId,
            cardId: defaultCardId,
            movementSource: 'scraper',
            metadata: {
                originalData: mov,
                cuenta: mov.cuenta,
                referencia: mov.referencia || taskId,
                estado: mov.estado,
                tipo: mov.tipo
            }
        };
    }
    getMovementsByCategory(movements) {
        return movements.reduce((acc, mov) => {
            const categoryName = mov.category?.nameCategory || 'Otros';
            acc[categoryName] = (acc[categoryName] || 0) + 1;
            return acc;
        }, {});
    }
    async updateScraperTaskStatus(taskId, update) {
        try {
            console.log(`[ScraperController] Actualizando tarea ${taskId}:`, update);
            const redisService = new redis_service_1.RedisService();
            const currentTaskData = await redisService.hGet(`scraper:tasks:${taskId}`, 'data');
            if (currentTaskData) {
                const currentTask = JSON.parse(currentTaskData);
                const updatedTask = {
                    ...currentTask,
                    ...update,
                    updated_at: new Date().toISOString()
                };
                await redisService.hSet(`scraper:tasks:${taskId}`, 'data', JSON.stringify(updatedTask));
                console.log(`[ScraperController] Tarea ${taskId} actualizada exitosamente`);
            }
            else {
                console.warn(`[ScraperController] No se encontró la tarea ${taskId} en Redis`);
            }
        }
        catch (error) {
            console.error(`[ScraperController] Error actualizando tarea ${taskId}:`, error);
        }
    }
}
exports.ScraperController = ScraperController;
//# sourceMappingURL=ScraperController.js.map