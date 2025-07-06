import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface TaskStatus {
  id: string;
  userId: number;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  message: string;
  progress: number;
  result?: any;
  createdAt: string;
  updatedAt: string;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private socket: Socket;
  private taskStatus = new BehaviorSubject<TaskStatus | null>(null);
  private isConnected = false;

  constructor() {
    console.log('Inicializando WebSocket Service (Frontend)');
    this.socket = io(environment.apiUrl, {
      transports: ['websocket'],
      autoConnect: false
    });

    this.setupSocketListeners();
  }
  private setupSocketListeners() {
    this.socket.on('connect', () => {
      console.log('WebSocket conectado al servidor');
      this.isConnected = true;
    });
    this.socket.on('disconnect', () => {
      console.log('WebSocket desconectado del servidor');
      this.isConnected = false;
    });
    this.socket.on('connect_error', (error) => {
      console.error('Error de conexión WebSocket:', error);
    });
    this.socket.on('task-update', (status: TaskStatus) => {
      console.log('Actualización de tarea recibida:', status);
      this.taskStatus.next(status);
    });
  }

  connect() {
    if (!this.isConnected) {
      console.log('Intentando conectar WebSocket...');
      this.socket.connect();
    }
  }

  disconnect() {
    if (this.isConnected) {
      console.log('Desconectando WebSocket...');
      this.socket.disconnect();
    }
  }

  subscribeToTask(taskId: string) {
    console.log(`Suscribiendo a tarea ${taskId}`);
    this.connect();
    this.socket.emit('subscribe-to-task', taskId);
  }

  unsubscribeFromTask(taskId: string) {
    console.log(`Desuscribiendo de tarea ${taskId}`);
    this.socket.emit('unsubscribe-from-task', taskId);
  }

  getTaskStatus(): Observable<TaskStatus | null> {
    return this.taskStatus.asObservable();
  }
} 