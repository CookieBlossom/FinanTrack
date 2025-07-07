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
  private activeTaskId: string | null = null;

  constructor() {
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
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // Resubscribir a la tarea activa si existe
      if (this.activeTaskId) {
        this.socket.emit('subscribe-to-task', this.activeTaskId);
      }
    });

    this.socket.on('disconnect', () => {
      this.isConnected = false;
      this.handleDisconnect();
    });

    this.socket.on('connect_error', (error) => {
      this.handleConnectionError(error);
    });

    this.socket.on('task-update', (status: TaskStatus) => {
      // Verificar si es un estado final
      const isFinalState = ['completed', 'failed', 'cancelled'].includes(status.status);
      
      this.taskStatus.next(status);
      
      // Si es un estado final, desuscribirse y desconectar después de un breve delay
      if (isFinalState) {
        setTimeout(() => {
          if (this.activeTaskId === status.id) {
            this.unsubscribeFromTask(status.id);
            this.disconnect();
            this.activeTaskId = null;
          }
        }, 1000);
      }
    });
  }

  private handleDisconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      
      // Solo intentar reconectar si hay una tarea activa que no está en estado final
      const currentStatus = this.taskStatus.getValue();
      const isActiveFinalState = currentStatus && ['completed', 'failed', 'cancelled'].includes(currentStatus.status);
      
      if (this.activeTaskId && !isActiveFinalState) {
        timer(this.reconnectDelay).subscribe(() => {
          if (!this.isConnected) {
            this.connect();
          }
        });
      }
    } else {
      // Notificar error en el estado
      const currentStatus = this.taskStatus.getValue();
      if (currentStatus) {
        this.taskStatus.next({
          ...currentStatus,
          status: 'failed',
          message: 'Error de conexión con el servidor',
          error: 'Máximo número de intentos de reconexión alcanzado'
        });
      }
    }
  }

  private handleConnectionError(error: Error) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
    } else {
      // Notificar error en el estado
      const currentStatus = this.taskStatus.getValue();
      if (currentStatus) {
        this.taskStatus.next({
          ...currentStatus,
          status: 'failed',
          message: 'Error de conexión con el servidor',
          error: error.message
        });
      }
    }
  }

  connect() {
    if (!this.isConnected) {
      this.socket.connect();
    }
  }

  disconnect() {
    if (this.isConnected) {
      this.socket.disconnect();
      this.isConnected = false;
    }
  }

  subscribeToTask(taskId: string) {
    this.activeTaskId = taskId;
    this.connect();
    this.socket.emit('subscribe-to-task', taskId);
  }

  unsubscribeFromTask(taskId: string) {
    if (this.activeTaskId === taskId) {
      this.activeTaskId = null;
    }
    this.socket.emit('unsubscribe-from-task', taskId);
  }

  getTaskStatus(): Observable<TaskStatus | null> {
    return this.taskStatus.asObservable().pipe(
      retryWhen(errors => 
        errors.pipe(
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