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

  constructor() {
    this.socket = io(environment.apiUrl, {
      transports: ['websocket'],
      autoConnect: false
    });

    this.socket.on('task-update', (status: TaskStatus) => {
      this.taskStatus.next(status);
    });
  }

  connect() {
    if (!this.socket.connected) {
      this.socket.connect();
    }
  }

  disconnect() {
    if (this.socket.connected) {
      this.socket.disconnect();
    }
  }

  subscribeToTask(taskId: string) {
    this.connect();
    this.socket.emit('subscribe-to-task', taskId);
  }

  unsubscribeFromTask(taskId: string) {
    this.socket.emit('unsubscribe-from-task', taskId);
  }

  getTaskStatus(): Observable<TaskStatus | null> {
    return this.taskStatus.asObservable();
  }
} 