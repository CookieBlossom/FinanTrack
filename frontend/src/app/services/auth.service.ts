import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { DatabaseService } from './database.service';
import { User, UserLogin, UserRegister, AuthResponse, ApiResponse } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    private http: HttpClient,
    private database: DatabaseService
  ) {
    this.loadCurrentUser();
  }

  register(userData: UserRegister): Observable<ApiResponse<User>> {
    console.log('AuthService - Iniciando registro con datos:', userData);
    const apiUrl = `${this.database.getApiUrl()}/users/register`;
    console.log('AuthService - URL de registro:', apiUrl);

    return this.http.post<ApiResponse<User>>(apiUrl, userData)
      .pipe(
        tap({
          next: (response) => {
            console.log('AuthService - Registro exitoso:', response);
          },
          error: (error) => {
            console.error('AuthService - Error en el registro:', error);
          }
        })
      );
  }

  login(credentials: UserLogin): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.database.getApiUrl()}/users/login`, credentials)
      .pipe(
        tap(response => {
          if (response && response.token) {
            this.setSession(response);
            this.currentUserSubject.next(response.user);
          }
        })
      );
  }

  logout(): void {
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    this.currentUserSubject.next(null);
  }

  getProfile(): Observable<User> {
    return this.http.get<User>(`${this.database.getApiUrl()}/users/profile`)
      .pipe(
        tap(user => {
          this.currentUserSubject.next(user);
          localStorage.setItem('currentUser', JSON.stringify(user));
        })
      );
  }

  updateProfile(data: any): Observable<User> {
    return this.http.put<User>(`${this.database.getApiUrl()}/users/profile`, data)
      .pipe(
        tap(user => {
          this.currentUserSubject.next(user);
          localStorage.setItem('currentUser', JSON.stringify(user));
        })
      );
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem('authToken');
  }

  getToken(): string | null {
    return localStorage.getItem('authToken');
  }

  private setSession(authResult: AuthResponse): void {
    localStorage.setItem('authToken', authResult.token);
    localStorage.setItem('currentUser', JSON.stringify(authResult.user));
  }

  private loadCurrentUser(): void {
    const userStr = localStorage.getItem('currentUser');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        this.currentUserSubject.next(user);
      } catch (e) {
        console.error('Error al parsear usuario del localStorage:', e);
        this.logout();
      }
    }
  }
} 