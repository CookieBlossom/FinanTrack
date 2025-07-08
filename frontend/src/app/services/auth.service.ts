import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject, Subject } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthResponse } from '../models/user.model';
import { AuthTokenService } from './auth-token.service';
import { Router } from '@angular/router';
import { CardCreate } from '../models/card.model';
import { PlanService } from './plan.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = environment.apiUrl;
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  private logoutEvent = new Subject<void>();
  
  isAuthenticated$ = this.isAuthenticatedSubject.asObservable();
  onLogout$ = this.logoutEvent.asObservable();

  constructor(
    private http: HttpClient,
    private authTokenService: AuthTokenService,
    private router: Router,
    private planService: PlanService
  ) {
    // Verificar el estado inicial de autenticación
    console.log(environment.apiUrl);
    this.isAuthenticatedSubject.next(this.authTokenService.isTokenValid());
  }

  register(userData: { firstName: string; lastName?: string; email: string; password: string }): Observable<AuthResponse> {
    console.log('Enviando datos de registro:', userData);
    const url = `${this.apiUrl}/users/register`;
    console.log('URL de registro:', url);
    
    return this.http.post<AuthResponse>(url, userData).pipe(
      tap(response => {
        console.log('Respuesta del servidor:', response);
        if (response.token) {
          this.authTokenService.setToken(response.token);
          this.isAuthenticatedSubject.next(true);
          // Cargar información del plan después del registro
          this.loadUserPlan();
        }
      }),
      catchError(this.handleError)
    );
  }

  checkEmailExists(email: string): Observable<{ success: boolean; exists: boolean; message: string }> {
    console.log('Verificando si el email existe:', email);
    const url = `${this.apiUrl}/users/check-email`;
    
    return this.http.post<{ success: boolean; exists: boolean; message: string }>(url, { email }).pipe(
      tap(response => {
        console.log('Respuesta de verificación de email:', response);
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
          // Cargar información del plan después del login
          this.loadUserPlan();
        }
      }),
      catchError(this.handleError)
    );
  }

  logout(): void {
    console.log('Cerrando sesión...');
    this.authTokenService.removeToken();
    this.isAuthenticatedSubject.next(false);
    // Emitir evento de logout
    this.logoutEvent.next();
    // Limpiar información del plan al cerrar sesión
    this.planService.clearCurrentPlan();
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

  /**
   * Carga la información del plan del usuario autenticado
   */
  private loadUserPlan(): void {
    if (this.isAuthenticated()) {
      this.planService.getCurrentPlan().subscribe({
        next: (plan) => {
          console.log('Plan del usuario cargado:', plan);
        },
        error: (error) => {
          console.error('Error al cargar el plan del usuario:', error);
        }
      });
    }
  }

  /**
   * Refresca la información del usuario incluyendo el plan
   */
  refreshUserInfo(): void {
    if (this.isAuthenticated()) {
      this.loadUserPlan();
    }
  }

  private handleError(error: HttpErrorResponse) {
    console.error('Error en la petición:', error);
    let errorMessage = 'Ha ocurrido un error en el servidor';
    
    if (error.error instanceof ErrorEvent) {
      // Error del lado del cliente
      errorMessage = 'Error de conexión. Verifique su conexión a internet.';
    } else {
      // Error del lado del servidor
      if (error.error && error.error.message) {
        // Usar el mensaje específico del backend
        errorMessage = error.error.message;
      } else {
        // Fallback a mensajes genéricos por código de estado
        switch (error.status) {
          case 400:
            errorMessage = 'Datos de entrada inválidos';
            break;
          case 401:
            errorMessage = 'Credenciales inválidas';
            break;
          case 403:
            errorMessage = 'Acceso denegado';
            break;
          case 404:
            errorMessage = 'El servicio no está disponible en este momento';
            break;
          case 409:
            errorMessage = 'El email ya está registrado en el sistema';
            break;
          case 422:
            errorMessage = 'Datos de validación incorrectos';
            break;
          case 500:
            errorMessage = 'Error interno del servidor. Por favor, intente nuevamente.';
            break;
          case 0:
            errorMessage = 'No se puede conectar con el servidor. Verifique su conexión a internet.';
            break;
          default:
            errorMessage = 'Ha ocurrido un error inesperado. Por favor, intente nuevamente.';
        }
      }
    }
    
    // Crear un error personalizado con información adicional
    const customError = new Error(errorMessage);
    (customError as any).status = error.status;
    (customError as any).errorCode = error.error?.error;
    (customError as any).originalError = error;
    
    return throwError(() => customError);
  }
} 