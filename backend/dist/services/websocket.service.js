"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketService = void 0;
const socket_io_1 = require("socket.io");
const ioredis_1 = require("ioredis");
const config_1 = require("../config/config");
class WebSocketService {
    constructor() {
        console.log('Conectando a Redis URL:', process.env.REDIS_URL || config_1.config.redis.url);
        this.redis = new ioredis_1.Redis(process.env.REDIS_URL || config_1.config.redis.url);
        this.redis.on('error', (err) => {
            console.error('WebSocket Redis Error:', err);
        });
        this.redis.on('connect', () => {
            console.log('WebSocket Redis Connected');
        });
    }
    static getInstance() {
        if (!WebSocketService.instance) {
            WebSocketService.instance = new WebSocketService();
        }
        return WebSocketService.instance;
    }
    initialize(server) {
        console.log('Inicializando WebSocket Service...');
        console.log('FRONTEND_URL:', process.env.FRONTEND_URL);
        console.log('BACKEND_URL:', process.env.BACKEND_URL);
        this.io = new socket_io_1.Server(server, {
            cors: {
                origin: process.env.FRONTEND_URL || 'http://localhost:4200',
                methods: ["GET", "POST"]
            }
        });
        this.io.on('connection', (socket) => {
            console.log('Cliente WebSocket conectado:', socket.id);
            socket.on('subscribe-to-task', async (taskId) => {
                console.log(`Cliente ${socket.id} suscrito a tarea ${taskId}`);
                socket.join(`task-${taskId}`);
                const taskStatus = await this.redis.get(`task:${taskId}`);
                if (taskStatus) {
                    console.log(`Enviando estado actual de tarea ${taskId}:`, taskStatus);
                    socket.emit('task-update', JSON.parse(taskStatus));
                }
                const subscriber = new ioredis_1.Redis(process.env.REDIS_URL || config_1.config.redis.url);
                await subscriber.subscribe(`task:${taskId}:updates`);
                subscriber.on('message', (channel, message) => {
                    console.log(`Actualización recibida para tarea ${taskId}:`, message);
                    const status = JSON.parse(message);
                    this.io.to(`task-${taskId}`).emit('task-update', status);
                });
                socket.on('disconnect', () => {
                    console.log(`Cliente ${socket.id} desconectado, limpiando suscripción a ${taskId}`);
                    subscriber.unsubscribe(`task:${taskId}:updates`);
                    subscriber.quit();
                });
            });
            socket.on('unsubscribe-from-task', (taskId) => {
                console.log(`Cliente ${socket.id} desuscrito de tarea ${taskId}`);
                socket.leave(`task-${taskId}`);
            });
            socket.on('disconnect', () => {
                console.log('Cliente WebSocket desconectado:', socket.id);
            });
        });
        console.log('WebSocket Service inicializado');
    }
    async updateTaskStatus(taskId, status) {
        try {
            console.log(`[WebSocketService] Actualizando estado de tarea ${taskId}:`, status);
            const updatedStatus = {
                ...status,
                updatedAt: new Date().toISOString()
            };
            // Guardar en Redis
            const statusKey = `task:${taskId}`;
            await this.redis.set(statusKey, JSON.stringify(updatedStatus));
            // Si la tarea está completada o fallida, establecer un TTL de 1 hora
            if (['completed', 'failed', 'cancelled'].includes(status.status)) {
                await this.redis.expire(statusKey, 3600); // 1 hora
            }
            // Publicar actualización
            const channel = `task:${taskId}:updates`;
            await this.redis.publish(channel, JSON.stringify(updatedStatus));
            // Enviar a todos los clientes en la sala
            const room = `task-${taskId}`;
            const clientsInRoom = this.io.sockets.adapter.rooms.get(room);
            const clientCount = clientsInRoom ? clientsInRoom.size : 0;
            console.log(`[WebSocketService] Enviando actualización a ${clientCount} clientes en sala ${room}`);
            if (clientCount > 0) {
                this.io.to(room).emit('task-update', updatedStatus);
                console.log(`[WebSocketService] Evento task-update emitido para tarea ${taskId}`);
            }
            else {
                console.log(`[WebSocketService] No hay clientes en la sala ${room}`);
            }
            // Verificar que la actualización se guardó correctamente
            const savedStatus = await this.redis.get(statusKey);
            if (savedStatus) {
                const parsed = JSON.parse(savedStatus);
                console.log(`[WebSocketService] Verificación - Estado guardado correctamente:`, {
                    taskId,
                    status: parsed.status,
                    progress: parsed.progress
                });
            }
            return true;
        }
        catch (err) {
            console.error(`[WebSocketService] Error al actualizar estado de tarea ${taskId}:`, err);
            if (err instanceof Error) {
                console.error(`[WebSocketService] Stack:`, err.stack);
            }
            throw err;
        }
    }
    async getTaskStatus(taskId) {
        try {
            const statusKey = `task:${taskId}`;
            const status = await this.redis.get(statusKey);
            if (status) {
                console.log(`[WebSocketService] Estado recuperado para tarea ${taskId}:`, status);
                return JSON.parse(status);
            }
            console.log(`[WebSocketService] No se encontró estado para tarea ${taskId}`);
            return null;
        }
        catch (err) {
            console.error(`[WebSocketService] Error al obtener estado de tarea ${taskId}:`, err);
            if (err instanceof Error) {
                console.error(`[WebSocketService] Stack:`, err.stack);
            }
            return null;
        }
    }
}
exports.WebSocketService = WebSocketService;
//# sourceMappingURL=websocket.service.js.map