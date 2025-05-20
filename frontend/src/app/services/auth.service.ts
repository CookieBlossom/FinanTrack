import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { DatabaseService } from './database.service';
import { UserLogin, UserRegister, AuthResponse, User, UserPasswordChange } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl: string;
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    private http: HttpClient,
    private database: DatabaseService
  ) {
    this.apiUrl = database.getApiUrl();
    this.loadCurrentUser();
  }

  /**
   * Login de usuario
   */
  login(credentials: UserLogin): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/users/login`, credentials)
      .pipe(
        tap(response => {
          if (response && response.token) {
            this.setSession(response);
            this.currentUserSubject.next(response.user);
          }
        })
      );
  }

  /**
   * Registro de usuario
   */
  register(userData: UserRegister): Observable<User> {
    return this.http.post<User>(`${this.apiUrl}/users/register`, userData);
  }

  /**
   * Cierre de sesión
   */
  logout(): void {
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    this.currentUserSubject.next(null);
  }

  /**
   * Obtener el perfil del usuario actual
   */
  getProfile(): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/users/profile`)
      .pipe(
        tap(user => {
          this.currentUserSubject.next(user);
          localStorage.setItem('currentUser', JSON.stringify(user));
        })
      );
  }

  /**
   * Actualizar el perfil del usuario
   */
  updateProfile(data: any): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/users/profile`, data)
      .pipe(
        tap(user => {
          this.currentUserSubject.next(user);
          localStorage.setItem('currentUser', JSON.stringify(user));
        })
      );
  }

  /**
   * Cambiar contraseña
   */
  changePassword(data: UserPasswordChange): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/users/change-password`, data);
  }

  /**
   * Comprobar si el usuario está autenticado
   */
  isAuthenticated(): boolean {
    return !!localStorage.getItem('authToken');
  }

  /**
   * Obtener el token de autenticación
   */
  getToken(): string | null {
    return localStorage.getItem('authToken');
  }

  /**
   * Almacenar datos de sesión tras login exitoso
   */
  private setSession(authResult: AuthResponse): void {
    localStorage.setItem('authToken', authResult.token);
    localStorage.setItem('currentUser', JSON.stringify(authResult.user));
  }

  /**
   * Cargar usuario guardado en localStorage (para persistencia entre recargas)
   */
  private loadCurrentUser(): void {
    const userStr = localStorage.getItem('currentUser');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        this.currentUserSubject.next(user);
      } catch (e) {
        console.error('Error parsing current user from localStorage', e);
        this.logout();
      }
    }
  }
} 