"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketService = void 0;
const socket_io_1 = require("socket.io");
const ioredis_1 = require("ioredis");
const config_1 = require("../config/config");
class WebSocketService {
    constructor() {
        this.redis = new ioredis_1.Redis(config_1.config.redis.url);
    }
    static getInstance() {
        if (!WebSocketService.instance) {
            WebSocketService.instance = new WebSocketService();
        }
        return WebSocketService.instance;
    }
    initialize(server) {
        this.io = new socket_io_1.Server(server, {
            cors: {
                origin: process.env.FRONTEND_URL || 'http://localhost:4200',
                methods: ["GET", "POST"]
            }
        });
        this.io.on('connection', (socket) => {
            console.log('Cliente conectado:', socket.id);
            socket.on('subscribe-to-task', async (taskId) => {
                socket.join(`task-${taskId}`);
                const taskStatus = await this.redis.get(`task:${taskId}`);
                if (taskStatus) {
                    socket.emit('task-update', JSON.parse(taskStatus));
                }
            });
            socket.on('disconnect', () => {
                console.log('Cliente desconectado:', socket.id);
            });
        });
    }
    async updateTaskStatus(taskId, status) {
        await this.redis.set(`task:${taskId}`, JSON.stringify(status));
        this.io.to(`task-${taskId}`).emit('task-update', status);
    }
    async getTaskStatus(taskId) {
        const status = await this.redis.get(`task:${taskId}`);
        return status ? JSON.parse(status) : null;
    }
}
exports.WebSocketService = WebSocketService;
//# sourceMappingURL=websocket.service.js.map