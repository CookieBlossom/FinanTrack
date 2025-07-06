import { Server } from 'socket.io';
import { Redis } from 'ioredis';
import { config } from '../config/config';

export class WebSocketService {
    private static instance: WebSocketService;
    private io!: Server; // Using definite assignment assertion
    private redis: Redis;

    private constructor() {
        this.redis = new Redis(config.redis.url);
    }

    public static getInstance(): WebSocketService {
        if (!WebSocketService.instance) {
            WebSocketService.instance = new WebSocketService();
        }
        return WebSocketService.instance;
    }

    public initialize(server: any) {
        this.io = new Server(server, {
            cors: {
                origin: process.env.FRONTEND_URL || 'http://localhost:4200',
                methods: ["GET", "POST"]
            }
        });

        this.io.on('connection', (socket) => {
            console.log('Cliente conectado:', socket.id);

            socket.on('subscribe-to-task', async (taskId: string) => {
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

    public async updateTaskStatus(taskId: string, status: any) {
        await this.redis.set(`task:${taskId}`, JSON.stringify(status));
        this.io.to(`task-${taskId}`).emit('task-update', status);
    }

    public async getTaskStatus(taskId: string) {
        const status = await this.redis.get(`task:${taskId}`);
        return status ? JSON.parse(status) : null;
    }
} 