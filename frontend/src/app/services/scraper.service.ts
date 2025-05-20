import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DatabaseService } from './database.service';

@Injectable({
  providedIn: 'root'
})
export class ScraperService {
  private apiUrl: string;

  constructor(
    private http: HttpClient,
    private database: DatabaseService
  ) {
    this.apiUrl = `${database.getApiUrl()}/scraper`;
  }

  /**
   * Inicia una nueva tarea de scraping
   */
  startScraping(credentials: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/task`, {
      credentials
    });
  }

  /**
   * Obtiene el estado de una tarea específica
   */
  getTaskStatus(taskId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/task/${taskId}`);
  }

  /**
   * Obtiene todas las tareas
   */
  getAllTasks(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/tasks`);
  }

  /**
   * Obtiene el estado general del scraper
   */
  getScraperStatus(): Observable<any> {
    return this.http.get(`${this.apiUrl}/status`);
  }

  /**
   * Limpia las tareas antiguas (solo para admins)
   */
  cleanupTasks(maxAgeHours: number = 24): Observable<any> {
    return this.http.post(`${this.apiUrl}/cleanup`, { maxAgeHours });
  }
} 