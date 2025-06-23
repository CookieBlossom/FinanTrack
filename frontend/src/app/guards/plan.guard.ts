import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { PlanService } from '../services/plan.service';
import { AuthService } from '../services/auth.service';
import { PLAN_PERMISSIONS } from '../models/plan.model';

@Injectable({
  providedIn: 'root'
})
export class PlanGuard implements CanActivate {
  constructor(
    private planService: PlanService,
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    // Verificar si el usuario está autenticado
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/login']);
      return of(false);
    }

    // Obtener el permiso requerido desde la ruta
    const requiredPermission = route.data['requiredPermission'] as string;
    
    // Si no se especifica permiso, permitir acceso
    if (!requiredPermission) {
      return of(true);
    }

    // Verificar si el usuario tiene el permiso requerido
    return this.planService.hasPermission(requiredPermission).pipe(
      map(hasPermission => {
        if (hasPermission) {
          return true;
        } else {
          // Redirigir a la página de planes si no tiene el permiso
          this.router.navigate(['/plans']);
          return false;
        }
      }),
      catchError(error => {
        console.error('Error al verificar permisos:', error);
        // En caso de error, redirigir a planes
        this.router.navigate(['/plans']);
        return of(false);
      })
    );
  }
}

/**
 * Guard para verificar límites específicos
 */
@Injectable({
  providedIn: 'root'
})
export class PlanLimitGuard implements CanActivate {
  constructor(
    private planService: PlanService,
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    // Verificar si el usuario está autenticado
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/login']);
      return of(false);
    }

    // Obtener el límite requerido desde la ruta
    const requiredLimit = route.data['requiredLimit'] as string;
    const currentCount = route.data['currentCount'] as number || 0;
    
    // Si no se especifica límite, permitir acceso
    if (!requiredLimit) {
      return of(true);
    }

    // Verificar si el usuario puede realizar la acción
    return this.planService.canPerformAction(requiredLimit, currentCount).pipe(
      map(canPerform => {
        if (canPerform) {
          return true;
        } else {
          // Redirigir a la página de planes si ha alcanzado el límite
          this.router.navigate(['/plans']);
          return false;
        }
      }),
      catchError(error => {
        console.error('Error al verificar límites:', error);
        // En caso de error, redirigir a planes
        this.router.navigate(['/plans']);
        return of(false);
      })
    );
  }
}

/**
 * Guard para verificar si el usuario tiene un plan específico
 */
@Injectable({
  providedIn: 'root'
})
export class PlanTypeGuard implements CanActivate {
  constructor(
    private planService: PlanService,
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    // Verificar si el usuario está autenticado
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/login']);
      return of(false);
    }

    // Obtener el plan requerido desde la ruta
    const requiredPlan = route.data['requiredPlan'] as string;
    
    // Si no se especifica plan, permitir acceso
    if (!requiredPlan) {
      return of(true);
    }

    // Obtener el plan actual del usuario
    return this.planService.getCurrentPlan().pipe(
      map(userPlan => {
        if (!userPlan) {
          this.router.navigate(['/plans']);
          return false;
        }

        // Verificar si el plan actual cumple con el requerido
        const planHierarchy = {
          'free': 1,
          'semi': 2,
          'premium': 3
        };

        const currentPlanLevel = planHierarchy[userPlan.planName as keyof typeof planHierarchy] || 0;
        const requiredPlanLevel = planHierarchy[requiredPlan as keyof typeof planHierarchy] || 0;

        if (currentPlanLevel >= requiredPlanLevel) {
          return true;
        } else {
          // Redirigir a la página de planes si no tiene el plan requerido
          this.router.navigate(['/plans']);
          return false;
        }
      }),
      catchError(error => {
        console.error('Error al verificar plan:', error);
        // En caso de error, redirigir a planes
        this.router.navigate(['/plans']);
        return of(false);
      })
    );
  }
} 