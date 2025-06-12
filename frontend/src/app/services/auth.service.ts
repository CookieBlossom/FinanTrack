import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthResponse } from '../models/user.model';
import { AuthTokenService } from './auth-token.service';
import { Router } from '@angular/router';
import { CardCreate } from '../models/card.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = environment.apiUrl;
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  constructor(
    private http: HttpClient,
    private authTokenService: AuthTokenService,
    private router: Router
  ) {
    // Verificar el estado inicial de autenticación
    this.isAuthenticatedSubject.next(this.authTokenService.isTokenValid());
  }

  register(userData: { email: string; password: string }): Observable<AuthResponse> {
    console.log('Enviando datos de registro:', userData);
    const url = `${this.apiUrl}/users/register`;
    console.log('URL de registro:', url);
    
    return this.http.post<AuthResponse>(url, userData).pipe(
      tap(response => {
        console.log('Respuesta del servidor:', response);
        if (response.token) {
          this.authTokenService.setToken(response.token);
          this.isAuthenticatedSubject.next(true);
        }
      }),
      catchError(this.handleError)
    );
  }

  login(credentials: { email: string; password: string }): Observable<AuthResponse> {
    console.log('Enviando datos de login:', credentials);
    const url = `${this.apiUrl}/users/login`;
    console.log('URL de login:', url);
    
    return this.http.post<AuthResponse>(url, credentials).pipe(
      tap(response => {
        console.log('Respuesta del servidor:', response);
        if (response.token) {
          this.authTokenService.setToken(response.token);
          this.isAuthenticatedSubject.next(true);
        }
      }),
      catchError(this.handleError)
    );
  }

  logout(): void {
    console.log('Cerrando sesión...');
    this.authTokenService.removeToken();
    this.isAuthenticatedSubject.next(false);
    this.router.navigate(['/login']);
  }

  isAuthenticated(): boolean {
    const isAuth = this.authTokenService.isTokenValid();
    this.isAuthenticatedSubject.next(isAuth);
    return isAuth;
  }

  getToken(): string | null {
    return this.authTokenService.getToken();
  }

  private handleError(error: HttpErrorResponse) {
    console.error('Error en la petición:', error);
    let errorMessage = 'Ha ocurrido un error en el servidor';
    
    if (error.error instanceof ErrorEvent) {
      // Error del lado del cliente
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Error del lado del servidor
      if (error.status === 404) {
        errorMessage = 'El servicio no está disponible en este momento';
      } else if (error.status === 400) {
        errorMessage = 'Datos de entrada inválidos';
      } else if (error.status === 401) {
        errorMessage = 'Credenciales inválidas';
      }
    }
    
    return throwError(() => new Error(errorMessage));
  }
} 