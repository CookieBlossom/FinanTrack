import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthTokenService } from '../services/auth-token.service';
import { Router } from '@angular/router';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { environment } from '../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authTokenService = inject(AuthTokenService);
  const router = inject(Router);
  
  // Solo interceptar peticiones a nuestra API
  if (!req.url.startsWith(environment.apiUrl)) {
    return next(req);
  }

  // No interceptar peticiones a rutas de autenticación
  if (req.url.includes('/users/login') || req.url.includes('/users/register')) {
    return next(req);
  }

  const token = authTokenService.getToken();
  
  if (!token) {
    console.log('No hay token en el interceptor');
    return next(req);
  }

  // Clonar la petición y agregar el header de autorización
  const authReq = req.clone({
    headers: req.headers.set('Authorization', `Bearer ${token.trim()}`)
  });

  return next(authReq).pipe(
    catchError((error) => {
      if (error.status === 401) {
        console.log('Token expirado o inválido');
        authTokenService.removeToken();
        router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
}; 