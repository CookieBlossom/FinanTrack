import { Server } from 'socket.io';
import { Redis } from 'ioredis';
import { config } from '../config/config';

export class WebSocketService {
    private static instance: WebSocketService;
    private io!: Server;
    private redis: Redis;
    private constructor() {
        console.log('Conectando a Redis URL:', process.env.REDIS_URL || config.redis.url);
        this.redis = new Redis(process.env.REDIS_URL || config.redis.url);
    }
    public static getInstance(): WebSocketService {
        if (!WebSocketService.instance) {
            WebSocketService.instance = new WebSocketService();
        }
        return WebSocketService.instance;
    }
    public initialize(server: any) {
        console.log('Inicializando WebSocket Service...');
        console.log('FRONTEND_URL:', process.env.FRONTEND_URL);
        console.log('BACKEND_URL:', process.env.BACKEND_URL);
        
        this.io = new Server(server, {
            cors: {
                origin: process.env.FRONTEND_URL || 'http://localhost:4200',
                methods: ["GET", "POST"]
            }
        });
        this.io.on('connection', (socket) => {
            console.log('Cliente WebSocket conectado:', socket.id);

            socket.on('subscribe-to-task', async (taskId: string) => {
                console.log(`Cliente ${socket.id} suscrito a tarea ${taskId}`);
                socket.join(`task-${taskId}`);
                
                const taskStatus = await this.redis.get(`task:${taskId}`);
                if (taskStatus) {
                    console.log(`Enviando estado actual de tarea ${taskId}:`, taskStatus);
                    socket.emit('task-update', JSON.parse(taskStatus));
                }
            });

            socket.on('unsubscribe-from-task', (taskId: string) => {
                console.log(`Cliente ${socket.id} desuscrito de tarea ${taskId}`);
                socket.leave(`task-${taskId}`);
            });

            socket.on('disconnect', () => {
                console.log('Cliente WebSocket desconectado:', socket.id);
            });
        });
        console.log('WebSocket Service inicializado');
    }

    public async updateTaskStatus(taskId: string, status: any) {
        try {
            console.log(`Actualizando estado de tarea ${taskId}:`, status);
            await this.redis.set(`task:${taskId}`, JSON.stringify(status));
            const room = `task-${taskId}`;
            const clientsInRoom = this.io.sockets.adapter.rooms.get(room);
            console.log(`Clientes en sala ${room}:`, clientsInRoom ? clientsInRoom.size : 0);
            this.io.to(room).emit('task-update', status);
            console.log(`Evento task-update emitido para tarea ${taskId}`);
        } catch (err: unknown) {
            console.error(`Error al actualizar estado de tarea ${taskId}:`, err);
            throw err;
        }
    }

    public async getTaskStatus(taskId: string) {
        try {
            const status = await this.redis.get(`task:${taskId}`);
            return status ? JSON.parse(status) : null;
        } catch (err: unknown) {
            console.error(`Error al obtener estado de tarea ${taskId}:`, err);
            return null;
        }
    }
} 