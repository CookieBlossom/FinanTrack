import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DatabaseService } from './database.service';

@Injectable({
  providedIn: 'root'
})
export class ApiBaseService<T> {
  protected apiUrl: string;

  constructor(
    protected http: HttpClient,
    protected database: DatabaseService,
    protected endpoint: string
  ) {
    this.apiUrl = `${database.getApiUrl()}/${endpoint}`;
  }

  /**
   * Obtiene todos los elementos
   */
  getAll(params?: any): Observable<T[]> {
    let httpParams = new HttpParams();
    
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
          if (params[key] instanceof Date) {
            httpParams = httpParams.set(key, params[key].toISOString());
          } else {
            httpParams = httpParams.set(key, params[key].toString());
          }
        }
      });
    }
    
    return this.http.get<T[]>(this.apiUrl, { params: httpParams });
  }

  /**
   * Obtiene un elemento por su ID
   */
  getById(id: number): Observable<T> {
    return this.http.get<T>(`${this.apiUrl}/${id}`);
  }

  /**
   * Crea un nuevo elemento
   */
  create(item: any): Observable<T> {
    return this.http.post<T>(this.apiUrl, item);
  }

  /**
   * Actualiza un elemento existente
   */
  update(id: number, item: any): Observable<T> {
    return this.http.put<T>(`${this.apiUrl}/${id}`, item);
  }

  /**
   * Elimina un elemento
   */
  delete(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
} 