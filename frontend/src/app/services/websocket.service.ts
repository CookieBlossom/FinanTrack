import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject, Observable, timer, Subject } from 'rxjs';
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

export interface ConnectionStatus {
  connected: boolean;
  error?: string;
  reconnecting?: boolean;
  reconnectAttempt?: number;
}

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private socket: Socket;
  private taskStatus = new BehaviorSubject<TaskStatus | null>(null);
  private connectionStatus = new BehaviorSubject<ConnectionStatus>({ connected: false });
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000; // 2 segundos
  private activeTaskId: string | null = null;
  private connectionErrors = new Subject<string>();

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
      console.log('🔌 [WebSocket] Conectado al servidor');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.connectionStatus.next({ connected: true });
      
      // Resubscribir a la tarea activa si existe
      if (this.activeTaskId) {
        console.log(`🔄 [WebSocket] Resubscribiendo a tarea: ${this.activeTaskId}`);
        this.socket.emit('subscribe-to-task', this.activeTaskId);
      }
    });

    this.socket.on('disconnect', () => {
      console.log('🔌 [WebSocket] Desconectado del servidor');
      this.isConnected = false;
      this.connectionStatus.next({ 
        connected: false, 
        error: 'Desconectado del servidor',
        reconnecting: true 
      });
      this.handleDisconnect();
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ [WebSocket] Error de conexión:', error);
      this.connectionStatus.next({ 
        connected: false, 
        error: `Error de conexión: ${error.message}`,
        reconnecting: true,
        reconnectAttempt: this.reconnectAttempts + 1
      });
      this.handleConnectionError(error);
    });

    this.socket.on('task-update', (status: TaskStatus) => {
      console.log(`📡 [WebSocket] Actualización de tarea recibida:`, status);
      
      // Verificar si es un estado final
      const isFinalState = ['completed', 'failed', 'cancelled'].includes(status.status);
      
      this.taskStatus.next(status);
      
      // Si es un estado final, esperar más tiempo antes de desconectar
      if (isFinalState) {
        console.log(`🏁 [WebSocket] Estado final detectado: ${status.status}`);
        // Primero desuscribirse de la tarea
        setTimeout(() => {
          if (this.activeTaskId === status.id) {
            console.log(`👋 [WebSocket] Desuscribiendo de tarea: ${status.id}`);
            this.unsubscribeFromTask(status.id);
            // Esperar un poco más antes de desconectar
            setTimeout(() => {
              console.log(`👋 [WebSocket] Desconectando después de estado final`);
              this.disconnect();
              this.activeTaskId = null;
            }, 5000); // 5 segundos adicionales después de desuscribirse
          }
        }, 5000); // 5 segundos para desuscribirse
      }
    });

    // Nuevo listener para errores específicos de tareas
    this.socket.on('task-error', (error: any) => {
      console.error('❌ [WebSocket] Error en tarea:', error);
      const currentStatus = this.taskStatus.getValue();
      if (currentStatus) {
        this.taskStatus.next({
          ...currentStatus,
          status: 'failed',
          message: error.message || 'Error en la tarea',
          error: error.details || error.message
        });
      }
      this.connectionErrors.next(error.message || 'Error en la tarea');
    });
  }

  private handleDisconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 [WebSocket] Intento de reconexión ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      
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
      console.error('❌ [WebSocket] Máximo de intentos de reconexión alcanzado');
      // Notificar error en el estado
      const currentStatus = this.taskStatus.getValue();
      if (currentStatus) {
        const errorMsg = 'Se perdió la conexión con el servidor';
        this.taskStatus.next({
          ...currentStatus,
          status: 'failed',
          message: errorMsg,
          error: 'Máximo número de intentos de reconexión alcanzado'
        });
        this.connectionErrors.next(errorMsg);
      }
    }
  }

  private handleConnectionError(error: Error) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 [WebSocket] Reintentando conexión después de error: ${error.message}`);
    } else {
      console.error('❌ [WebSocket] Error de conexión fatal:', error);
      // Notificar error en el estado
      const currentStatus = this.taskStatus.getValue();
      if (currentStatus) {
        const errorMsg = `Error de conexión: ${error.message}`;
        this.taskStatus.next({
          ...currentStatus,
          status: 'failed',
          message: errorMsg,
          error: error.message
        });
        this.connectionErrors.next(errorMsg);
      }
    }
  }

  connect() {
    if (!this.isConnected) {
      console.log('🔌 [WebSocket] Intentando conectar...');
      this.socket.connect();
    }
  }

  disconnect() {
    if (this.isConnected) {
      console.log('👋 [WebSocket] Desconectando...');
      this.socket.disconnect();
      this.isConnected = false;
      this.connectionStatus.next({ connected: false });
    }
  }

  subscribeToTask(taskId: string) {
    console.log(`📥 [WebSocket] Suscribiendo a tarea: ${taskId}`);
    this.activeTaskId = taskId;
    this.connect();
    this.socket.emit('subscribe-to-task', taskId);
  }

  unsubscribeFromTask(taskId: string) {
    console.log(`📤 [WebSocket] Desuscribiendo de tarea: ${taskId}`);
    if (this.activeTaskId === taskId) {
      this.activeTaskId = null;
    }
    this.socket.emit('unsubscribe-from-task', taskId);
  }

  getTaskStatus(): Observable<TaskStatus | null> {
    return this.taskStatus.asObservable().pipe(
      retryWhen(errors => 
        errors.pipe(
          tap(error => console.error('❌ [WebSocket] Error en observable de estado:', error)),
          delay(this.reconnectDelay),
          take(this.maxReconnectAttempts)
        )
      )
    );
  }

  getConnectionStatus(): Observable<ConnectionStatus> {
    return this.connectionStatus.asObservable();
  }

  getConnectionErrors(): Observable<string> {
    return this.connectionErrors.asObservable();
  }

  isSocketConnected(): boolean {
    return this.isConnected;
  }
} 