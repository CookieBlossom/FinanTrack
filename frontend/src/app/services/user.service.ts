import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiBaseService } from './api-base.service';
import { DatabaseService } from './database.service';
import { User, UserProfileUpdate } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class UserService extends ApiBaseService<User> {
  
  constructor(
    protected override http: HttpClient,
    protected override database: DatabaseService
  ) {
    super(http, database, 'users');
  }

  /**
   * Obtener todos los usuarios (solo para administradores)
   */
  override getAll(): Observable<User[]> {
    return super.getAll();
  }

  /**
   * Obtener un usuario específico por ID (solo para administradores)
   */
  override getById(id: number): Observable<User> {
    return super.getById(id);
  }

  /**
   * Actualizar datos de perfil del usuario actual
   */
  updateProfile(data: UserProfileUpdate): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/profile`, data);
  }

  /**
   * Actualizar un usuario (solo para administradores)
   */
  override update(id: number, data: Partial<User>): Observable<User> {
    return super.update(id, data);
  }
} 