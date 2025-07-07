import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject, Observable, timer } from 'rxjs';
import { environment } from '../../environments/environment';
import { retryWhen, delay, take, tap } from 'rxjs/operators';

export interface TaskStatus {
  id: string;
  userId: number;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'cancelling';
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
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000; // 2 segundos

  constructor() {
    console.log('[WebSocketService] Inicializando servicio');
    this.socket = io(environment.apiUrl, {
      transports: ['websocket'],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay
    });

    this.setupSocketListeners();
  }

  private setupSocketListeners() {
    this.socket.on('connect', () => {
      console.log('[WebSocketService] Conectado al servidor');
      this.isConnected = true;
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', () => {
      console.log('[WebSocketService] Desconectado del servidor');
      this.isConnected = false;
      this.handleDisconnect();
    });

    this.socket.on('connect_error', (error) => {
      console.error('[WebSocketService] Error de conexión:', error);
      this.handleConnectionError(error);
    });

    this.socket.on('task-update', (status: TaskStatus) => {
      console.log('[WebSocketService] Actualización de tarea recibida:', status);
      this.taskStatus.next(status);
    });
  }

  private handleDisconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`[WebSocketService] Intento de reconexión ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      
      timer(this.reconnectDelay).subscribe(() => {
        if (!this.isConnected) {
          this.connect();
        }
      });
    } else {
      console.error('[WebSocketService] Máximo número de intentos de reconexión alcanzado');
    }
  }

  private handleConnectionError(error: Error) {
    console.error('[WebSocketService] Error de conexión:', error);
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`[WebSocketService] Reintentando conexión ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
    }
  }

  connect() {
    if (!this.isConnected) {
      console.log('[WebSocketService] Intentando conectar...');
      this.socket.connect();
    }
  }

  disconnect() {
    if (this.isConnected) {
      console.log('[WebSocketService] Desconectando...');
      this.socket.disconnect();
    }
  }

  subscribeToTask(taskId: string) {
    console.log(`[WebSocketService] Suscribiendo a tarea ${taskId}`);
    this.connect();
    this.socket.emit('subscribe-to-task', taskId);
  }

  unsubscribeFromTask(taskId: string) {
    console.log(`[WebSocketService] Desuscribiendo de tarea ${taskId}`);
    this.socket.emit('unsubscribe-from-task', taskId);
  }

  getTaskStatus(): Observable<TaskStatus | null> {
    return this.taskStatus.asObservable().pipe(
      retryWhen(errors => 
        errors.pipe(
          tap(error => console.error('[WebSocketService] Error en el stream de estado:', error)),
          delay(this.reconnectDelay),
          take(this.maxReconnectAttempts)
        )
      )
    );
  }

  isSocketConnected(): boolean {
    return this.isConnected;
  }
} 