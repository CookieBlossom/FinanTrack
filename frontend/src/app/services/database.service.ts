import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DatabaseService {
  private apiUrl = 'http://localhost:3000'; // URL del backend

  constructor(private http: HttpClient) {}
  
  /**
   * Devuelve la URL base de la API
   */
  getApiUrl(): string {
    return this.apiUrl;
  }

  /**
   * Método de ejemplo para obtener usuarios
   * Este método podría moverse a un UserService específico
   */
  getUsers(): Observable<any> {
    return this.http.get(`${this.apiUrl}/users`);
  }
}