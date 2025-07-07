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
const websocket_service_1 = require("../services/websocket.service");
const company_service_1 = require("../services/company.service");
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
                const { rawMovements, userId, scraperTaskId: taskId, cuentas } = req.body;
                scraperTaskId = taskId;
                if (!Array.isArray(rawMovements) || typeof userId !== 'number' || typeof scraperTaskId !== 'string') {
                    return res.status(400).json({ message: 'Datos inválidos en el payload del scraper' });
                }
                if (userId === 0) {
                    return res.status(400).json({ message: 'userId no puede ser 0' });
                }
                console.log(`[ScraperController] Procesando ${rawMovements.length} movimientos del scraper para usuario ${userId}`);
                if (cuentas && Array.isArray(cuentas)) {
                    console.log(`[ScraperController] Procesando ${cuentas.length} cuentas detectadas por el scraper:`, cuentas.map(c => `${c.tipo} (${c.numero})`));
                }
                await this.updateScraperTaskStatus(scraperTaskId, {
                    status: 'processing',
                    message: `Procesando ${rawMovements.length} movimientos...`,
                    progress: 10
                });
                const cardService = new card_service_1.CardService();
                const userService = new user_service_1.UserService();
                const movementService = new movement_service_1.MovementService();
                // Obtener el plan real del usuario desde la base de datos
                const user = await userService.getUserById(userId);
                if (!user) {
                    return res.status(404).json({ message: 'Usuario no encontrado' });
                }
                const planId = user.plan_id;
                console.log(`[ScraperController] Usuario ${userId} tiene plan ID ${planId}`);
                // Procesar todas las cuentas encontradas por el scraper
                const processedCards = new Map();
                if (cuentas && Array.isArray(cuentas)) {
                    for (const cuenta of cuentas) {
                        try {
                            console.log(`[ScraperController] Procesando cuenta: ${cuenta.tipo} - ${cuenta.numero}`);
                            // Determinar si es CuentaRUT
                            const isCuentaRUT = cuenta.tipo.toUpperCase().includes('CUENTARUT') ||
                                cuenta.tipo.toUpperCase().includes('CUENTA RUT');
                            // Crear o encontrar la tarjeta
                            const result = await cardService.findOrCreateCardFromScraper(userId, cuenta.tipo, cuenta.titular || 'Usuario Scraper', cuenta.saldo || 0, 'scraper', cuenta.numero // Agregamos el número de cuenta como referencia
                            );
                            processedCards.set(cuenta.numero, result.cardId);
                            console.log(`[ScraperController] Cuenta ${result.wasCreated ? 'creada' : 'encontrada'} con ID ${result.cardId} para número ${cuenta.numero}`);
                        }
                        catch (error) {
                            console.error(`[ScraperController] Error procesando cuenta ${cuenta.tipo}:`, error);
                        }
                    }
                }
                console.log('[ScraperController] Mapeo de cuentas procesadas:', Array.from(processedCards.entries()).map(([numero, id]) => `${numero} -> ${id}`));
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
                        // Encontrar la tarjeta correspondiente para este movimiento
                        const cardId = processedCards.get(rawMov.cuenta);
                        if (!cardId) {
                            throw new Error(`No se encontró tarjeta para el movimiento de la cuenta ${rawMov.cuenta}`);
                        }
                        const movementToCreate = await this.convertScraperMovement(rawMov, scraperTaskId, cardId);
                        const newMovement = await movementService.createMovement(movementToCreate, userId, planId);
                        createdMovements.push(newMovement);
                        console.log(`[ScraperController] Movimiento creado: ${newMovement.description} - ${newMovement.amount} para tarjeta ${cardId} (cuenta ${rawMov.cuenta})`);
                        if (i % 5 === 0 || i === rawMovements.length - 1) {
                            const progress = 30 + Math.round((i / rawMovements.length) * 60);
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
                    por_categoria: this.getMovementsByCategory(createdMovements),
                    cuentas_procesadas: Array.from(processedCards.entries()).map(([numero, id]) => ({
                        numero,
                        id,
                        movimientos: createdMovements.filter(m => m.cardId === id).length
                    }))
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
                        message: `${createdMovements.length} movimientos procesados exitosamente`,
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
        // Intentar categorizar usando CompanyService
        const companyService = new company_service_1.CompanyService();
        const categoryId = await companyService.findCategoryForDescription(mov.descripcion) || 1;
        const originalAmount = mov.monto;
        const absoluteAmount = Math.abs(originalAmount);
        const determinedType = mov.movement_type || (originalAmount > 0 ? 'income' : 'expense');
        // Crear una clave única para el movimiento
        const uniqueKey = `${mov.fecha}_${mov.descripcion}_${mov.monto}_${mov.cuenta}`;
        console.log(`[ScraperController] Generando clave única para movimiento: ${uniqueKey}`);
        return {
            description: mov.descripcion,
            amount: absoluteAmount,
            transactionDate: this.parseScraperDate(mov.fecha),
            movementType: determinedType,
            categoryId,
            cardId: defaultCardId,
            movementSource: 'scraper',
            metadata: {
                originalData: mov,
                cuenta: mov.cuenta,
                referencia: mov.referencia || taskId,
                estado: mov.estado,
                tipo: mov.tipo,
                uniqueKey
            }
        };
    }
    parseScraperDate(fechaStr) {
        try {
            // Formato esperado: DD/MM/YYYY
            const parts = fechaStr.split('/');
            if (parts.length !== 3) {
                console.error(`[ScraperController] Formato de fecha inválido: ${fechaStr}`);
                return new Date(); // Fecha actual como fallback
            }
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1; // Los meses en JavaScript van de 0-11
            const year = parseInt(parts[2], 10);
            // Validar que los componentes sean números válidos
            if (isNaN(day) || isNaN(month) || isNaN(year)) {
                console.error(`[ScraperController] Componentes de fecha inválidos: ${fechaStr}`);
                return new Date(); // Fecha actual como fallback
            }
            // Crear fecha en UTC para evitar problemas de zona horaria
            const parsedDate = new Date(Date.UTC(year, month, day));
            if (isNaN(parsedDate.getTime())) {
                console.error(`[ScraperController] Fecha parsing resultó en fecha inválida: ${fechaStr}`);
                return new Date(); // Fecha actual como fallback
            }
            console.log(`[ScraperController] Fecha parseada correctamente: ${fechaStr} -> ${parsedDate.toISOString()}`);
            return parsedDate;
        }
        catch (error) {
            console.error(`[ScraperController] Error parseando fecha ${fechaStr}:`, error);
            return new Date(); // Fecha actual como fallback
        }
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
            const webSocketService = websocket_service_1.WebSocketService.getInstance();
            const currentTaskData = await redisService.hGet(`scraper:tasks:${taskId}`, 'data');
            let updatedTask;
            if (currentTaskData) {
                const currentTask = JSON.parse(currentTaskData);
                updatedTask = {
                    ...currentTask,
                    ...update,
                    updated_at: new Date().toISOString()
                };
            }
            else {
                console.warn(`[ScraperController] No se encontró la tarea ${taskId} en Redis`);
                // Intentar crear la tarea con la información disponible
                updatedTask = {
                    id: taskId,
                    status: update.status || 'processing',
                    message: update.message || 'Procesando...',
                    progress: update.progress || 0,
                    result: update.result || null,
                    error: update.error || null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };
            }
            // Guardar en Redis
            await redisService.hSet(`scraper:tasks:${taskId}`, 'data', JSON.stringify(updatedTask));
            console.log(`[ScraperController] Tarea ${taskId} actualizada en Redis. Estado: ${updatedTask.status}`);
            // Notificar a través de WebSocket
            await webSocketService.updateTaskStatus(taskId, updatedTask);
            console.log(`[ScraperController] Notificación WebSocket enviada para tarea ${taskId}`);
            // Verificar que la actualización se guardó correctamente
            const verifyData = await redisService.hGet(`scraper:tasks:${taskId}`, 'data');
            if (verifyData) {
                const verifyTask = JSON.parse(verifyData);
                console.log(`[ScraperController] Verificación - Tarea ${taskId} estado: ${verifyTask.status}, progreso: ${verifyTask.progress}%`);
            }
        }
        catch (error) {
            console.error(`[ScraperController] Error crítico actualizando tarea ${taskId}:`, error);
            if (error instanceof Error) {
                console.error(`[ScraperController] Error stack:`, error.stack);
            }
            // Si hay un error crítico de Redis, intentar reconectarse
            if (error instanceof Error && (error.message?.includes('Connection') || error.message?.includes('ECONNREFUSED'))) {
                console.error(`[ScraperController] Error de conexión Redis detectado. Tarea ${taskId} no se pudo actualizar.`);
            }
        }
    }
}
exports.ScraperController = ScraperController;
//# sourceMappingURL=ScraperController.js.map