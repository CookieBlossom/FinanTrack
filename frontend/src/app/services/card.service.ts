import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiBaseService } from './api-base.service';
import { DatabaseService } from './database.service';
import { Card, CardCreate, CardUpdate } from '../models/card.model';

@Injectable({
  providedIn: 'root'
})
export class CardService extends ApiBaseService<Card> {
  
  constructor(
    protected override http: HttpClient,
    protected override database: DatabaseService
  ) {
    super(http, database, 'cards');
  }

  /**
   * Obtener todas las tarjetas del usuario actual
   */
  getUserCards(): Observable<Card[]> {
    return this.http.get<Card[]>(`${this.apiUrl}/user`);
  }

  /**
   * Crear una nueva tarjeta
   */
  override create(data: CardCreate): Observable<Card> {
    return super.create(data);
  }

  /**
   * Actualizar una tarjeta
   */
  override update(id: number, data: CardUpdate): Observable<Card> {
    return super.update(id, data);
  }

  /**
   * Actualizar el balance de una tarjeta
   */
  updateBalance(id: number, balance: number): Observable<Card> {
    return this.http.put<Card>(`${this.apiUrl}/${id}/balance`, { balance });
  }

  /**
   * Activar una tarjeta
   */
  activateCard(id: number): Observable<Card> {
    return this.http.put<Card>(`${this.apiUrl}/${id}/activate`, {});
  }

  /**
   * Desactivar una tarjeta
   */
  deactivateCard(id: number): Observable<Card> {
    return this.http.put<Card>(`${this.apiUrl}/${id}/deactivate`, {});
  }
} 