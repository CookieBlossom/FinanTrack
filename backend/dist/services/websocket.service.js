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
            console.log(`Actualizando estado de tarea ${taskId}:`, status);
            await this.redis.set(`task:${taskId}`, JSON.stringify(status));
            await this.redis.publish(`task:${taskId}:updates`, JSON.stringify(status));
            const room = `task-${taskId}`;
            const clientsInRoom = this.io.sockets.adapter.rooms.get(room);
            console.log(`Clientes en sala ${room}:`, clientsInRoom ? clientsInRoom.size : 0);
            this.io.to(room).emit('task-update', status);
            console.log(`Evento task-update emitido para tarea ${taskId}`);
        }
        catch (err) {
            console.error(`Error al actualizar estado de tarea ${taskId}:`, err);
            throw err;
        }
    }
    async getTaskStatus(taskId) {
        try {
            const status = await this.redis.get(`task:${taskId}`);
            return status ? JSON.parse(status) : null;
        }
        catch (err) {
            console.error(`Error al obtener estado de tarea ${taskId}:`, err);
            return null;
        }
    }
}
exports.WebSocketService = WebSocketService;
//# sourceMappingURL=websocket.service.js.map