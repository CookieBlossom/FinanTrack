import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DatabaseService } from './database.service';
import { User, UserProfileUpdate, UserPasswordChange } from '../models/user.model';
import { environment } from '../../environments/environment';
import { AuthTokenService } from './auth-token.service';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  constructor(
    private database: DatabaseService,
    private authTokenService: AuthTokenService
  ) {
    this.apiUrl = `${this.database.getApiUrl()}/users`;
  }

  private getHeaders(): HttpHeaders {
    const token = this.authTokenService.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  getAll(): Observable<User[]> {
    return this.http.get<User[]>(this.apiUrl);
  }
  getById(id: number): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/${id}`);
  }
  updateProfile(data: UserProfileUpdate): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/profile`, data, { headers: this.getHeaders() });
  }
  update(id: number, data: Partial<User>): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/${id}`, data);
  }
  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
  getProfile(): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/profile`, { headers: this.getHeaders() });
  }
  updatePassword(data: UserPasswordChange): Observable<any> {
    console.log('Enviando datos de cambio de contraseña:', data);
    return this.http.put(`${this.apiUrl}/change-password`, data, { 
      headers: this.getHeaders() 
    });
  }
  forgotPassword(email: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/forgot-password`, { email });
  }
  resetPassword(token: string, newPassword: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/reset-password`, {
      token,
      newPassword
    });
  }
  deleteAccount(): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/profile`);
  }
} 