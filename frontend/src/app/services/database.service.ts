import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class DatabaseService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {
    // Si estamos en producción, usaríamos la URL de producción
    // this.apiUrl = environment.apiUrl;
  }
  getApiUrl(): string {
    return this.apiUrl;
  }
  getUsers(): Observable<any> {
    return this.http.get(`${this.apiUrl}/users`);
  }
}