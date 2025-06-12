import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, timer, Subject, takeWhile } from 'rxjs';
import { catchError, switchMap, takeUntil, map, retryWhen, delay, take } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthTokenService } from './auth-token.service';
import { ScraperTask, ScraperCredentials, ScraperResponse } from '../models/scraper.model';
import { RutUtils } from '../utils/rut.utils';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';

export interface ScraperStatus {
  isRunning: boolean;
  activeTasks: number;
  lastSync: Date;
  errors: string[];
}

@Injectable({
  providedIn: 'root'
})
export class ScraperService {
  private apiUrl = `${environment.apiUrl}/scraper`;
  private taskPollingSubject = new Subject<void>();
  private readonly POLL_INTERVAL = 5000; // 5 segundos
  private readonly MAX_POLL_TIME = 5 * 60 * 1000; // 5 minutos
  private readonly MAX_RETRIES = 3;

  constructor(
    private http: HttpClient,
    private authTokenService: AuthTokenService,
    private authService: AuthService
  ) {}

  private getHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  private handleError(error: HttpErrorResponse) {
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
  }

  createTask(credentials: ScraperCredentials): Observable<ScraperTask> {
    if (!credentials.rut || !credentials.password) {
      return throwError(() => new Error('Se requieren credenciales válidas (RUT y contraseña)'));
    }

    try {
      const cleanRut = credentials.rut.replace(/[^0-9kK]/g, '').toUpperCase();
      if (cleanRut.length < 8 || cleanRut.length > 9) {
        return throwError(() => new Error('El formato del RUT no es válido'));
      }

      const formattedCredentials = {
        rut: cleanRut,
        password: credentials.password,
        site: 'banco-estado'
      };

      return this.http.post<ScraperResponse<ScraperTask>>(
        `${this.apiUrl}/task`,
        formattedCredentials,
        { headers: this.getHeaders() }
      ).pipe(
        map(response => {
          if (!response.success || !response.data) {
            throw new Error(response.message || 'Error al crear la tarea');
          }
          return response.data;
        }),
        catchError(error => {
          console.error('Error al crear tarea:', error);
          return throwError(() => new Error(error.error?.message || 'Error al crear la tarea de scraping'));
        })
      );
    } catch (error) {
      return throwError(() => error);
    }
  }

  getTask(taskId: string): Observable<ScraperTask> {
    if (!taskId) {
      return throwError(() => new Error('Se requiere un ID de tarea válido'));
    }

    const headers = this.getHeaders();
    return this.http.get<ScraperResponse<ScraperTask>>(`${this.apiUrl}/task/${taskId}`, { headers }).pipe(
      map(response => {
        if (!response.success || !response.data) {
          throw new Error(response.message || 'Error al obtener la tarea');
        }
        return response.data;
      }),
      catchError(this.handleError)
    );
  }

  getAllTasks(): Observable<ScraperTask[]> {
    const headers = this.getHeaders();
    return this.http.get<ScraperResponse<ScraperTask[]>>(`${this.apiUrl}/tasks`, { headers }).pipe(
      map(response => {
        if (!response.success || !response.data) {
          throw new Error(response.message || 'Error al obtener las tareas');
        }
        return response.data;
      }),
      catchError(this.handleError)
    );
  }

  stopPolling(): void {
    this.taskPollingSubject.next();
  }

  pollTaskStatus(taskId: string): Observable<ScraperTask> {
    return timer(0, 2000).pipe(
      switchMap(() => this.getTaskStatus(taskId)),
      takeWhile(task => task.status === 'pending' || task.status === 'processing', true)
    );
  }

  getTaskStatus(taskId: string): Observable<ScraperTask> {
    return this.http.get<ScraperResponse<ScraperTask>>(
      `${this.apiUrl}/task/${taskId}`,
      { headers: this.getHeaders() }
    ).pipe(
      map(response => {
        if (!response.success || !response.data) {
          throw new Error(response.message || 'Error al obtener el estado de la tarea');
        }
        return response.data;
      }),
      catchError(error => {
        console.error('Error al obtener estado de tarea:', error);
        return throwError(() => new Error(error.error?.message || 'Error al obtener el estado de la tarea'));
      })
    );
  }

  private calculateProgress(status: string): number {
    const progressMap: { [key: string]: number } = {
      'initializing': 10,
      'connecting': 20,
      'logging_in': 30,
      'fetching_accounts': 50,
      'fetching_movements': 70,
      'processing': 90,
      'completed': 100,
      'failed': 0
    };
    return progressMap[status] || 0;
  }

  getScraperStatus(): Observable<ScraperStatus> {
    const headers = this.getHeaders();
    return this.http.get<ScraperResponse<ScraperStatus>>(
      `${this.apiUrl}/status`,
      { headers }
    ).pipe(
      map(response => {
        if (!response.success || !response.data) {
          throw new Error(response.message || 'Error al obtener el estado del scraper');
        }
        return response.data;
      }),
      catchError(this.handleError)
    );
  }

  cleanupTasks(maxAgeHours: number = 24): Observable<{ message: string; deletedTasks: number }> {
    const headers = this.getHeaders();
    return this.http.post<{ message: string; deletedTasks: number }>(
      `${this.apiUrl}/cleanup`,
      { maxAgeHours },
      { headers }
    ).pipe(
      catchError(this.handleError)
    );
  }

  cancelTask(taskId: string): Observable<void> {
    const headers = this.getHeaders();
    return this.http.post<ScraperResponse<void>>(
      `${this.apiUrl}/task/${taskId}/cancel`,
      {},
      { headers }
    ).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.message || 'Error al cancelar la tarea');
        }
      }),
      catchError(this.handleError)
    );
  }
} 