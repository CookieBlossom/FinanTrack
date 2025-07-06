import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { map, catchError, tap, filter } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { WebSocketService } from './websocket.service';

export interface ScraperTask {
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

export interface ScraperCredentials {
  rut: string;
  password: string;
  site: string;
}

export interface ScraperResponse<T> {
  success: boolean;
  message: string;
  data?: T;
}

@Injectable({
  providedIn: 'root'
})
export class ScraperService {
  private apiUrl = `${environment.apiUrl}/scraper`;
  private currentTask = new BehaviorSubject<ScraperTask | null>(null);

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private wsService: WebSocketService
  ) {}

  private getHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  private handleError = (error: HttpErrorResponse) => {
    console.error('Error en el servicio de scraper:', error);
    let errorMessage = 'Error en el servicio de scraper';

    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error: ${error.error.message}`;
    } else if (error.status === 400) {
      errorMessage = error.error?.message || 'Error de validación en la solicitud';
    } else if (error.status === 401) {
      errorMessage = 'No autorizado. Por favor, inicie sesión nuevamente.';
    } else if (error.status === 404) {
      errorMessage = 'Recurso no encontrado';
    } else if (error.status === 0) {
      errorMessage = 'Error de conexión con el servidor';
    } else {
      errorMessage = `Error del servidor: ${error.status}. ${error.error?.message || ''}`;
    }

    return throwError(() => new Error(errorMessage));
  };

  // Iniciar scraping
  startScraping(credentials: ScraperCredentials): Observable<any> {
    if (!credentials.rut || !credentials.password) {
      return throwError(() => new Error('Se requieren credenciales válidas (RUT y contraseña)'));
    }

    if (!this.validateRut(credentials.rut)) {
      return throwError(() => new Error('El formato del RUT no es válido'));
    }

    const formattedCredentials = {
      rut: credentials.rut,
      password: credentials.password,
      site: credentials.site || 'banco-estado'
    };

    return this.http.post<ScraperResponse<{ taskId: string }>>(
      `${this.apiUrl}/task`,
      formattedCredentials,
      { headers: this.getHeaders() }
    ).pipe(
      tap(response => {
        if (response.success && response.data?.taskId) {
          this.wsService.subscribeToTask(response.data.taskId);
        }
      }),
      map(response => {
        if (!response.success) {
          throw new Error(response.message || 'Error al crear la tarea');
        }
        return response;
      }),
      catchError(this.handleError)
    );
  }

  // Obtener estado de una tarea
  getTaskStatus(taskId: string): Observable<ScraperResponse<ScraperTask>> {
    if (!taskId) {
      return throwError(() => new Error('Se requiere un ID de tarea válido'));
    }

    return this.http.get<ScraperResponse<ScraperTask>>(
      `${this.apiUrl}/task/${taskId}`,
      { headers: this.getHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }

  // Cancelar tarea
  cancelTask(taskId: string): Observable<any> {
    if (!taskId) {
      return throwError(() => new Error('Se requiere un ID de tarea válido'));
    }

    return this.http.post<any>(
      `${this.apiUrl}/task/${taskId}/cancel`,
      {},
      { headers: this.getHeaders() }
    ).pipe(
      tap(() => {
        this.wsService.unsubscribeFromTask(taskId);
      }),
      catchError(this.handleError)
    );
  }

  // Monitorear progreso de una tarea (usando WebSocket)
  monitorTask(taskId: string): Observable<ScraperTask> {
    this.wsService.subscribeToTask(taskId);
    return this.wsService.getTaskStatus().pipe(
      filter((task): task is ScraperTask => task !== null)
    );
  }

  // Obtener todas las tareas del usuario
  getAllTasks(): Observable<ScraperTask[]> {
    return this.http.get<ScraperResponse<ScraperTask[]>>(
      `${this.apiUrl}/tasks`,
      { headers: this.getHeaders() }
    ).pipe(
      map(response => {
        if (!response.success || !response.data) {
          throw new Error(response.message || 'Error al obtener las tareas');
        }
        return response.data;
      }),
      catchError(this.handleError)
    );
  }

  // Validar RUT chileno
  validateRut(rut: string): boolean {
    if (!rut || typeof rut !== 'string') return false;
    const cleanRut = rut.replace(/\./g, '').replace(/-/g, '');
    if (!/^[0-9]{7,8}[0-9Kk]$/.test(cleanRut)) return false;
    const digits = cleanRut.slice(0, -1);
    const verifier = cleanRut.slice(-1).toUpperCase();
    let sum = 0;
    let multiplier = 2;
    
    for (let i = digits.length - 1; i >= 0; i--) {
      sum += parseInt(digits[i]) * multiplier;
      multiplier = multiplier === 7 ? 2 : multiplier + 1;
    }
    
    const remainder = sum % 11;
    const expectedDv = 11 - remainder;
    
    let calculatedVerifier: string;
    if (expectedDv === 11) {
      calculatedVerifier = '0';
    } else if (expectedDv === 10) {
      calculatedVerifier = 'K';
    } else {
      calculatedVerifier = expectedDv.toString();
    }
    
    return verifier === calculatedVerifier;
  }
  formatRut(rut: string): string {
    if (!rut) return '';
    
    const cleanRut = rut.replace(/\./g, '').replace(/-/g, '');
    if (cleanRut.length < 8) return rut;
    
    const digits = cleanRut.slice(0, -1);
    const verifier = cleanRut.slice(-1);
    
    // Formatear con puntos y guión
    const formatted = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${formatted}-${verifier}`;
  }

  // Limpiar tareas antiguas
  cleanupTasks(maxAgeHours: number = 24): Observable<{ message: string; deletedTasks: number }> {
    return this.http.post<{ message: string; deletedTasks: number }>(
      `${this.apiUrl}/cleanup`,
      { maxAgeHours },
      { headers: this.getHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }
} 