import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { PlanService } from './plan.service';
import { PLAN_LIMITS, PLAN_PERMISSIONS, PlanUsage } from '../models/plan.model';

export interface LimitCheck {
  canPerform: boolean;
  reason?: string;
  limit?: number;
  used?: number;
  remaining?: number;
  isUnlimited: boolean;
}

export interface PermissionCheck {
  hasPermission: boolean;
  reason?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PlanLimitsService {
  private currentUsageSubject = new BehaviorSubject<PlanUsage | null>(null);
  currentUsage$ = this.currentUsageSubject.asObservable();

  constructor(private planService: PlanService) {
    this.loadCurrentUsage();
  }

  /**
   * Carga el uso actual del usuario
   */
  loadCurrentUsage(): void {
    this.planService.getCurrentUsage().subscribe({
      next: (usage) => {
        this.currentUsageSubject.next(usage);
      },
      error: (error) => {
        console.error('Error al cargar el uso actual:', error);
      }
    });
  }

  /**
   * Verifica si el usuario puede crear un movimiento manual
   */
  canCreateManualMovement(): Observable<LimitCheck> {
    return this.checkLimit(PLAN_LIMITS.MANUAL_MOVEMENTS, 'movimientos manuales');
  }

  /**
   * Verifica si el usuario puede crear una tarjeta
   */
  canCreateCard(): Observable<LimitCheck> {
    return this.checkLimit(PLAN_LIMITS.MAX_CARDS, 'tarjetas');
  }

  /**
   * Verifica si el usuario puede agregar keywords a una categoría
   */
  canAddKeywords(keywordsCount: number): Observable<LimitCheck> {
    return this.checkLimit(PLAN_LIMITS.KEYWORDS_PER_CATEGORY, 'palabras clave por categoría', keywordsCount);
  }

  /**
   * Verifica si el usuario puede subir una cartola
   */
  canUploadCartola(): Observable<PermissionCheck> {
    return this.checkPermission(PLAN_PERMISSIONS.CARTOLA_UPLOAD, 'subir cartolas bancarias');
  }

  /**
   * Verifica si el usuario puede usar el scraper
   */
  canUseScraper(): Observable<PermissionCheck> {
    return this.checkPermission(PLAN_PERMISSIONS.SCRAPER_ACCESS, 'usar el scraper automático');
  }

  /**
   * Verifica si el usuario puede exportar datos
   */
  canExportData(): Observable<PermissionCheck> {
    return this.checkPermission(PLAN_PERMISSIONS.EXPORT_DATA, 'exportar datos');
  }

  /**
   * Verifica si el usuario puede usar categorización avanzada
   */
  canUseAdvancedCategorization(): Observable<PermissionCheck> {
    return this.checkPermission(PLAN_PERMISSIONS.ADVANCED_CATEGORIZATION, 'categorización avanzada');
  }

  /**
   * Verifica si el usuario puede crear un movimiento proyectado
   */
  canCreateProjectedMovement(): Observable<LimitCheck> {
    return this.checkLimit(PLAN_LIMITS.PROJECTED_MOVEMENTS, 'movimientos proyectados');
  }

  /**
   * Obtiene los datos de uso para una clave específica
   */
  private getUsageData(usage: PlanUsage | null, limitKey: string): { used: number; limit: number; remaining: number } | null {
    if (!usage) return null;
    
    switch (limitKey) {
      case PLAN_LIMITS.MANUAL_MOVEMENTS:
        return usage.manual_movements;
      case PLAN_LIMITS.MAX_CARDS:
        return usage.max_cards;
      case PLAN_LIMITS.KEYWORDS_PER_CATEGORY:
        return usage.keywords_per_category;
      case PLAN_LIMITS.CARTOLA_MOVEMENTS:
        return usage.cartola_movements;
      case PLAN_LIMITS.SCRAPER_MOVEMENTS:
        return usage.scraper_movements;
      case PLAN_LIMITS.PROJECTED_MOVEMENTS:
        return usage.projected_movements;
      case PLAN_LIMITS.MONTHLY_CARTOLAS:
        // Para límites que no están en PlanUsage, devolver null
        return null;
      case PLAN_LIMITS.MONTHLY_SCRAPES:
        // Para límites que no están en PlanUsage, devolver null
        return null;
      default:
        return null;
    }
  }

  /**
   * Verifica un límite específico
   */
  private checkLimit(limitKey: string, featureName: string, requiredAmount: number = 1): Observable<LimitCheck> {
    return combineLatest([
      this.planService.getPlanLimits(),
      this.currentUsage$
    ]).pipe(
      map(([limits, usage]) => {
        if (!usage) {
          return {
            canPerform: false,
            reason: 'No se pudo cargar la información de uso',
            isUnlimited: false
          };
        }

        const limit = limits[limitKey];
        const usageData = this.getUsageData(usage, limitKey);
        const currentUsage = usageData?.used || 0;
        const remaining = usageData?.remaining || 0;

        // Si el límite no está definido o es -1, es ilimitado
        if (limit === undefined || limit === -1) {
          return {
            canPerform: true,
            isUnlimited: true,
            limit: -1,
            used: currentUsage,
            remaining: -1
          };
        }

        // Verificar si hay espacio suficiente
        if (remaining >= requiredAmount) {
          return {
            canPerform: true,
            limit,
            used: currentUsage,
            remaining,
            isUnlimited: false
          };
        } else {
          return {
            canPerform: false,
            reason: `Has alcanzado el límite de ${limit} ${featureName} para tu plan`,
            limit,
            used: currentUsage,
            remaining,
            isUnlimited: false
          };
        }
      })
    );
  }
  private checkPermission(permissionKey: string, featureName: string): Observable<PermissionCheck> {
    return this.planService.hasPermission(permissionKey).pipe(
      map(hasPermission => ({
        hasPermission,
        reason: hasPermission ? undefined : `Tu plan no incluye ${featureName}`
      }))
    );
  }
  refreshUsage(): void {
    // Siempre cargar datos actualizados cuando se solicita explícitamente
    this.loadCurrentUsage();
  }
  getCurrentUsage(): PlanUsage | null {
    return this.currentUsageSubject.value;
  }
  getCurrentUsageObservable(): Observable<PlanUsage | null> {
    return this.currentUsage$;
  }
  getUsagePercentage(limitKey: string): Observable<number> {
    return combineLatest([
      this.planService.getPlanLimits(),
      this.currentUsage$
    ]).pipe(
      map(([limits, usage]) => {
        const usageData = this.getUsageData(usage, limitKey);
        if (!usageData) {
          return 0;
        }

        const limit = limits[limitKey];
        const used = usageData.used;

        if (limit === -1 || limit === 0) {
          return 0; // Ilimitado o sin límite
        }

        return Math.min((used / limit) * 100, 100);
      })
    );
  }

  /**
   * Obtiene el estado visual de un límite (normal, warning, danger)
   */
  getLimitStatus(limitKey: string): Observable<'normal' | 'warning' | 'danger'> {
    return this.getUsagePercentage(limitKey).pipe(
      map(percentage => {
        if (percentage >= 90) return 'danger';
        if (percentage >= 75) return 'warning';
        return 'normal';
      })
    );
  }

  /**
   * Obtiene la información completa de un límite específico
   */
  getLimitStatusInfo(limitKey: string): Observable<{limit: number, currentUsage: number, remaining: number}> {
    return combineLatest([
      this.planService.getPlanLimits(),
      this.currentUsage$
    ]).pipe(
      map(([limits, usage]) => {
        const planLimit = limits[limitKey];
        if (planLimit === -1 || planLimit === undefined) {
          return {
            limit: -1,
            currentUsage: 0,
            remaining: -1
          };
        }
        const usageData = this.getUsageData(usage, limitKey);
        if (!usageData) {
          return {
            limit: planLimit,
            currentUsage: 0,
            remaining: planLimit
          };
        }
        const currentUsage = usageData.used || 0;
        const remaining = usageData.remaining || 0;

        return {
          limit: planLimit,
          currentUsage,
          remaining
        };
      })
    );
  }
} 