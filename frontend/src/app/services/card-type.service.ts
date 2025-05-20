import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiBaseService } from './api-base.service';
import { DatabaseService } from './database.service';
import { CardType, CardTypeCreate, CardTypeUpdate } from '../models/card-type.model';

@Injectable({
  providedIn: 'root'
})
export class CardTypeService extends ApiBaseService<CardType> {
  
  constructor(
    protected override http: HttpClient,
    protected override database: DatabaseService
  ) {
    super(http, database, 'card-types');
  }

  /**
   * Obtener todos los tipos de tarjeta
   */
  override getAll(): Observable<CardType[]> {
    return super.getAll();
  }

  /**
   * Crear un nuevo tipo de tarjeta (solo administradores)
   */
  override create(data: CardTypeCreate): Observable<CardType> {
    return super.create(data);
  }

  /**
   * Actualizar un tipo de tarjeta (solo administradores)
   */
  override update(id: number, data: CardTypeUpdate): Observable<CardType> {
    return super.update(id, data);
  }

  /**
   * Eliminar un tipo de tarjeta (solo administradores)
   */
  override delete(id: number): Observable<any> {
    return super.delete(id);
  }
} 