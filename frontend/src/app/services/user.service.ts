import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DatabaseService } from './database.service';
import { User, UserProfileUpdate } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apiUrl: string;

  constructor(
    private http: HttpClient,
    private database: DatabaseService
  ) {
    this.apiUrl = `${this.database.getApiUrl()}/users`;
  }

  /**
   * Obtener todos los usuarios (solo para administradores)
   */
  getAll(): Observable<User[]> {
    return this.http.get<User[]>(this.apiUrl);
  }

  /**
   * Obtener un usuario específico por ID (solo para administradores)
   */
  getById(id: number): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/${id}`);
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
  update(id: number, data: Partial<User>): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/${id}`, data);
  }

  /**
   * Eliminar un usuario (solo para administradores)
   */
  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
} 