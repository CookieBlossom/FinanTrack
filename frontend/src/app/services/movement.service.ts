import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Movement, MovementCreate, MovementFilters } from '../models/movement.model';

@Injectable({
  providedIn: 'root'
})
export class MovementService {
  private apiUrl = `${environment.apiUrl}/movements`;

  constructor(private http: HttpClient) {}

  getMovements(source: 'manual' | 'scraper' | 'cartola'): Observable<Movement[]> {
    return this.http.get<Movement[]>(`${this.apiUrl}?movementSource=${source}`);
  }

  getCardMovements(): Observable<Movement[]> {
    return this.http.get<Movement[]>(`${this.apiUrl}/card-movements`);
  }

  addMovement(movement: MovementCreate): Observable<Movement> {
    const movementData = {
      ...movement,
      movementSource: 'manual'
    };
    return this.http.post<Movement>(this.apiUrl, movementData);
  }

  getFilteredMovements(filters: MovementFilters): Observable<Movement[]> {
    return this.http.post<Movement[]>(`${this.apiUrl}/filter`, filters);
  }
  getCashMovements(): Observable<Movement[]> {
    return this.http.get<Movement[]>(`${this.apiUrl}/cash`);
  }
  updateMovement(id: number, movement: Partial<Movement>): Observable<Movement> {
    return this.http.patch<Movement>(`${this.apiUrl}/${id}`, movement);
  }

  deleteMovement(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  uploadCartola(formData: FormData): Observable<any> {
    return this.http.post(`${this.apiUrl}/cartola`, formData);
  }

  getMonthlySummary(month: string) {
    return this.http.get<any>(`${this.apiUrl}/monthly-summary?month=${month}`);
  }
} 