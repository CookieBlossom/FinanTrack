import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import {
  Plan,
  UserPlan,
  PlanUsage,
  PlanLimitStatus,
  PaymentSession,
  PlansPageResponse,
  AuthStatusResponse,
  InitiatePaymentRequest,
  InitiatePaymentResponse,
  ConfirmPaymentRequest,
  ConfirmPaymentResponse,
  PLAN_LIMITS,
  PLAN_PERMISSIONS,
  PLAN_NAMES
} from '../models/plan.model';

@Injectable({
  providedIn: 'root'
})
export class PlanService {
  private apiUrl = environment.apiUrl;
  private currentUserPlanSubject = new BehaviorSubject<UserPlan | null>(null);
  currentUserPlan$ = this.currentUserPlanSubject.asObservable();

  constructor(private http: HttpClient) {}

  // ===== ENDPOINTS PÚBLICOS =====

  /**
   * Obtiene información de todos los planes disponibles
   */
  getPlansInfo(): Observable<Plan[]> {
    const url = `${this.apiUrl}/plans-page/plans`;
    return this.http.get<PlansPageResponse>(url).pipe(
      map(response => response.plans),
      catchError(this.handleError)
    );
  }

  /**
   * Verifica el estado de autenticación para la página de planes
   */
  checkAuthStatus(): Observable<AuthStatusResponse> {
    const url = `${this.apiUrl}/plans-page/auth-status`;
    return this.http.get<AuthStatusResponse>(url).pipe(
      catchError(this.handleError)
    );
  }
  // ===== ENDPOINTS PRIVADOS =====
  /**
   * Obtiene el plan actual del usuario
   */
  getCurrentPlan(): Observable<UserPlan> {
    const url = `${this.apiUrl}/plans`;
    return this.http.get<UserPlan>(url).pipe(
      tap(plan => this.currentUserPlanSubject.next(plan)),
      catchError(this.handleError)
    );
  }

  /**
   * Obtiene los límites del plan actual
   */
  getPlanLimits(): Observable<Record<string, number>> {
    const url = `${this.apiUrl}/plans/limits`;
    return this.http.get<Record<string, number>>(url).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Obtiene los permisos del plan actual
   */
  getPlanPermissions(): Observable<string[]> {
    const url = `${this.apiUrl}/plans/permissions`;
    return this.http.get<string[]>(url).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Obtiene el uso actual del usuario
   */
  getCurrentUsage(): Observable<PlanUsage> {
    const url = `${this.apiUrl}/plans/usage`;
    return this.http.get<PlanUsage>(url).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Inicia el proceso de pago para un plan
   */
  initiatePayment(planId: number): Observable<InitiatePaymentResponse> {
    const url = `${this.apiUrl}/plans-page/initiate-payment`;
    const request: InitiatePaymentRequest = { planId };
    return this.http.post<InitiatePaymentResponse>(url, request).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Confirma un pago exitoso
   */
  confirmPayment(sessionId: string, planId: number): Observable<ConfirmPaymentResponse> {
    const url = `${this.apiUrl}/plans-page/confirm-payment`;
    const request: ConfirmPaymentRequest = { sessionId, planId };
    return this.http.post<ConfirmPaymentResponse>(url, request).pipe(
      tap(response => {
        // Actualizar el plan del usuario después de confirmar el pago
        this.refreshCurrentPlan();
      }),
      catchError(this.handleError)
    );
  }

  // ===== MÉTODOS DE UTILIDAD =====

  /**
   * Refresca la información del plan actual
   */
  refreshCurrentPlan(): void {
    this.getCurrentPlan().subscribe({
      next: (plan) => {
        this.currentUserPlanSubject.next(plan);
      },
      error: (error) => {
        console.error('Error al refrescar el plan:', error);
      }
    });
  }

  /**
   * Verifica si el usuario tiene un permiso específico
   */
  hasPermission(permission: string): Observable<boolean> {
    return this.getPlanPermissions().pipe(
      map(permissions => permissions.includes(permission))
    );
  }

  /**
   * Verifica si el usuario puede realizar una acción basada en límites
   */
  canPerformAction(limitKey: string, currentCount: number): Observable<boolean> {
    return this.getPlanLimits().pipe(
      map(limits => {
        const limit = limits[limitKey];
        
        // Si no hay límite configurado, permitir por defecto
        if (limit === undefined) {
          return true;
        }
        
        // Si es ilimitado (-1), siempre permitir
        if (this.isUnlimited(limit)) {
          return true;
        }
        
        // Verificar si no se ha excedido el límite
        return currentCount < limit;
      })
    );
  }

  /**
   * Obtiene el estado de un límite específico
   */
  getLimitStatus(limitKey: string, currentUsage: number): Observable<PlanLimitStatus> {
    return this.getPlanLimits().pipe(
      map(limits => {
        const limit = limits[limitKey] || 0;
        const isUnlimited = this.isUnlimited(limit);
        const remaining = isUnlimited ? -1 : Math.max(0, limit - currentUsage);
        const percentageUsed = isUnlimited ? 0 : (limit > 0 ? (currentUsage / limit) * 100 : 0);

        return {
          limitKey,
          currentUsage,
          limit,
          remaining,
          isUnlimited,
          percentageUsed
        };
      })
    );
  }

  /**
   * Verifica si un valor representa un límite ilimitado
   */
  private isUnlimited(value: number): boolean {
    return value === -1;
  }

  /**
   * Obtiene el plan actual del usuario desde el BehaviorSubject
   */
  getCurrentUserPlan(): UserPlan | null {
    return this.currentUserPlanSubject.value;
  }

  /**
   * Limpia el plan actual (útil para logout)
   */
  clearCurrentPlan(): void {
    this.currentUserPlanSubject.next(null);
  }

  // ===== CONSTANTES Y HELPERS =====

  /**
   * Obtiene el nombre legible de un límite
   */
  getLimitDisplayName(limitKey: string): string {
    const displayNames: Record<string, string> = {
      [PLAN_LIMITS.MANUAL_MOVEMENTS]: 'Movimientos Manuales',
      [PLAN_LIMITS.MAX_CARDS]: 'Tarjetas',
      [PLAN_LIMITS.KEYWORDS_PER_CATEGORY]: 'Palabras Clave por Categoría',
      [PLAN_LIMITS.CARTOLA_MOVEMENTS]: 'Movimientos de Cartola',
      [PLAN_LIMITS.SCRAPER_MOVEMENTS]: 'Movimientos del Scraper',
      [PLAN_LIMITS.MONTHLY_CARTOLAS]: 'Cartolas por Mes',
      [PLAN_LIMITS.MONTHLY_SCRAPES]: 'Sincronizaciones por Mes'
    };
    return displayNames[limitKey] || limitKey;
  }

  /**
   * Obtiene el nombre legible de un permiso
   */
  getPermissionDisplayName(permission: string): string {
    const displayNames: Record<string, string> = {
      [PLAN_PERMISSIONS.MANUAL_MOVEMENTS]: 'Movimientos Manuales',
      [PLAN_PERMISSIONS.MANUAL_CARDS]: 'Tarjetas Manuales',
      [PLAN_PERMISSIONS.BASIC_CATEGORIZATION]: 'Categorización Básica',
      [PLAN_PERMISSIONS.ADVANCED_CATEGORIZATION]: 'Categorización Avanzada',
      [PLAN_PERMISSIONS.CARTOLA_UPLOAD]: 'Subida de Cartolas',
      [PLAN_PERMISSIONS.SCRAPER_ACCESS]: 'Acceso al Scraper',
      [PLAN_PERMISSIONS.AUTOMATED_CATEGORIZATION]: 'Categorización Automática',
      [PLAN_PERMISSIONS.EXPORT_DATA]: 'Exportación de Datos',
      [PLAN_PERMISSIONS.API_ACCESS]: 'Acceso a API',
      [PLAN_PERMISSIONS.EXECUTIVE_DASHBOARD]: 'Dashboard Ejecutivo',
      [PLAN_PERMISSIONS.EMAIL_SUPPORT]: 'Soporte por Email',
      [PLAN_PERMISSIONS.PRIORITY_SUPPORT]: 'Soporte Prioritario'
    };
    return displayNames[permission] || permission;
  }

  /**
   * Obtiene el nombre legible de un plan
   */
  getPlanDisplayName(planName: string): string {
    const displayNames: Record<string, string> = {
      [PLAN_NAMES.FREE]: 'Gratis',
      [PLAN_NAMES.BASIC]: 'Básico',
      [PLAN_NAMES.PREMIUM]: 'Premium',
      [PLAN_NAMES.PRO]: 'Pro'
    };
    return displayNames[planName] || planName;
  }

  private handleError(error: HttpErrorResponse) {
    console.error('Error en PlanService:', error);
    let errorMessage = 'Ha ocurrido un error en el servidor';
    
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error: ${error.error.message}`;
    } else {
      if (error.status === 404) {
        errorMessage = 'El servicio no está disponible en este momento';
      } else if (error.status === 400) {
        errorMessage = 'Datos de entrada inválidos';
      } else if (error.status === 401) {
        errorMessage = 'No tienes permisos para realizar esta acción';
      } else if (error.status === 403) {
        errorMessage = 'Tu plan actual no incluye esta funcionalidad';
      }
    }
    
    return throwError(() => new Error(errorMessage));
  }
} 