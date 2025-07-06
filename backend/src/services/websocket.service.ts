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

        this.redis.on('error', (err) => {
            console.error('WebSocket Redis Error:', err);
        });

        this.redis.on('connect', () => {
            console.log('WebSocket Redis Connected');
        });
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
                const subscriber = new Redis(process.env.REDIS_URL || config.redis.url);
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
            await this.redis.publish(`task:${taskId}:updates`, JSON.stringify(status));
            
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