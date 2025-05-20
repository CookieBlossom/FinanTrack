import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiBaseService } from './api-base.service';
import { DatabaseService } from './database.service';
import { Movement, MovementCreate, MovementUpdate, MovementFilters } from '../models/movement.model';

@Injectable({
  providedIn: 'root'
})
export class MovementService extends ApiBaseService<Movement> {
  
  constructor(
    protected override http: HttpClient,
    protected override database: DatabaseService
  ) {
    super(http, database, 'movements');
  }

  /**
   * Obtener todos los movimientos con filtros opcionales
   */
  override getAll(filters?: MovementFilters): Observable<Movement[]> {
    return super.getAll(filters);
  }

  /**
   * Obtener movimientos por tarjeta
   */
  getByCard(cardId: number, filters?: Omit<MovementFilters, 'cardId'>): Observable<Movement[]> {
    const params = { ...filters, cardId };
    return super.getAll(params);
  }

  /**
   * Obtener movimientos por categoría
   */
  getByCategory(categoryId: number, filters?: Omit<MovementFilters, 'categoryId'>): Observable<Movement[]> {
    const params = { ...filters, categoryId };
    return super.getAll(params);
  }

  /**
   * Obtener movimientos por tipo (ingreso/gasto)
   */
  getByType(movementType: 'income' | 'expense', filters?: Omit<MovementFilters, 'movementType'>): Observable<Movement[]> {
    const params = { ...filters, movementType };
    return super.getAll(params);
  }

  /**
   * Obtener movimientos por rango de fechas
   */
  getByDateRange(startDate: Date, endDate: Date, filters?: Omit<MovementFilters, 'startDate' | 'endDate'>): Observable<Movement[]> {
    const params = { ...filters, startDate, endDate };
    return super.getAll(params);
  }

  /**
   * Crear un nuevo movimiento
   */
  override create(data: MovementCreate): Observable<Movement> {
    return super.create(data);
  }

  /**
   * Actualizar un movimiento existente
   */
  override update(id: number, data: MovementUpdate): Observable<Movement> {
    return super.update(id, data);
  }

  /**
   * Obtener estadísticas de movimientos por período
   */
  getStatistics(period: 'daily' | 'weekly' | 'monthly' | 'yearly', filters?: MovementFilters): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/statistics/${period}`, { params: filters as any });
  }
} 