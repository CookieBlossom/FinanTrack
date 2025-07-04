"use strict";
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BancoEstadoService = void 0;
const common_1 = require("@nestjs/common");
const child_process_1 = require("child_process");
const path_1 = require("path");
let BancoEstadoService = (() => {
    let _classDecorators = [(0, common_1.Injectable)()];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var BancoEstadoService = _classThis = class {
        constructor(redisService, scraperService) {
            this.redisService = redisService;
            this.scraperService = scraperService;
        }
        async executeScraperTask(userId, credentials) {
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
            }
            catch (error) {
                console.error('[BancoEstadoService] Error al crear tarea de scraping:', error);
                throw new Error('Error al iniciar el proceso de scraping para Banco Estado');
            }
        }
        async getTaskStatus(taskId) {
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
            }
            catch (error) {
                console.error('[BancoEstadoService] Error al obtener estado de tarea:', error);
                return null;
            }
        }
        transformScraperResult(result) {
            if (!result)
                return null;
            // Transformar las cuentas al formato esperado por el frontend
            const cards = result.cuentas?.map((cuenta) => ({
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
        async cancelTask(taskId) {
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
            }
            catch (error) {
                console.error('[BancoEstadoService] Error al cancelar tarea:', error);
                return {
                    success: false,
                    message: error instanceof Error ? error.message : 'Error interno al cancelar la tarea',
                    taskId
                };
            }
        }
        async runScraper(config = {}) {
            // Encontrar la raíz del proyecto - solución robusta
            const currentDir = process.cwd(); // C:\Proyectos\FinanTrack\backend
            const projectRoot = (0, path_1.join)(currentDir, '..'); // C:\Proyectos\FinanTrack
            console.log('projectRoot:', projectRoot);
            const scriptPath = (0, path_1.join)(projectRoot, 'scraper', 'sites', 'banco_estado', 'banco_estado_manager.py');
            const fs = require('fs');
            if (!fs.existsSync(scriptPath)) {
                console.error(`[BancoEstadoService] ERROR: El script no existe en: ${scriptPath}`);
                return;
            }
            const pythonCommands = ['py', 'python', 'python3'];
            let pythonPath = null;
            
            for (const cmd of pythonCommands) {
                try {
                    const { execSync } = require('child_process');
                    execSync(`${cmd} --version`, { stdio: 'pipe' });
                    pythonPath = cmd;
                    break;
                } catch (error) {
                    // Continuar con el siguiente comando
                }
            }
            
            if (!pythonPath) {
                console.error(`[BancoEstadoService] ERROR: No se encontró Python instalado. Instala Python o verifica el PATH.`);
                return;
            }
            const scraperProcess = (0, child_process_1.spawn)(pythonPath, [scriptPath], {
                env: {
                    ...process.env,
                    REDIS_HOST: config.redisHost || 'localhost',
                    REDIS_PORT: config.redisPort || '6379',
                    PYTHONPATH: (0, path_1.join)(projectRoot, 'scraper')
                },
                cwd: (0, path_1.join)(projectRoot, 'scraper', 'sites', 'banco_estado')
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
    };
    __setFunctionName(_classThis, "BancoEstadoService");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        BancoEstadoService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return BancoEstadoService = _classThis;
})();
exports.BancoEstadoService = BancoEstadoService;
//# sourceMappingURL=banco-estado.service.js.map