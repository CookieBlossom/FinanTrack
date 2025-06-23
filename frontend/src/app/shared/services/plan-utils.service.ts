import { Injectable } from '@angular/core';
import { Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { PlanService } from '../../services/plan.service';
import { PlanUsage, PlanLimitStatus, PLAN_LIMITS } from '../../models/plan.model';

@Injectable({
  providedIn: 'root'
})
export class PlanUtilsService {
  constructor(private planService: PlanService) {}

  /**
   * Obtiene el estado completo de todos los límites del usuario
   */
  getAllLimitStatuses(): Observable<PlanLimitStatus[]> {
    return combineLatest([
      this.planService.getCurrentUsage(),
      this.planService.getPlanLimits()
    ]).pipe(
      map(([usage, limits]) => {
        const limitStatuses: PlanLimitStatus[] = [];
        
        // Movimientos manuales
        limitStatuses.push(this.createLimitStatus(
          PLAN_LIMITS.MANUAL_MOVEMENTS,
          usage.manualMovesCount,
          limits[PLAN_LIMITS.MANUAL_MOVEMENTS] || 0
        ));

        // Tarjetas manuales
        limitStatuses.push(this.createLimitStatus(
          PLAN_LIMITS.MANUAL_CARDS,
          usage.manualCardsCount,
          limits[PLAN_LIMITS.MANUAL_CARDS] || 0
        ));

        // Categorías personalizadas
        limitStatuses.push(this.createLimitStatus(
          PLAN_LIMITS.CUSTOM_CATEGORIES,
          usage.customCategoriesCount,
          limits[PLAN_LIMITS.CUSTOM_CATEGORIES] || 0
        ));

        // Movimientos de cartola
        limitStatuses.push(this.createLimitStatus(
          PLAN_LIMITS.CARTOLA_MOVEMENTS,
          usage.cartolaMovesCount,
          limits[PLAN_LIMITS.CARTOLA_MOVEMENTS] || 0
        ));

        // Tareas de scraper
        limitStatuses.push(this.createLimitStatus(
          PLAN_LIMITS.SCRAPER_TASKS,
          usage.scraperTasksCount,
          limits[PLAN_LIMITS.SCRAPER_TASKS] || 0
        ));

        // Movimientos proyectados
        limitStatuses.push(this.createLimitStatus(
          PLAN_LIMITS.PROJECTED_MOVEMENTS,
          usage.projectedMovesCount,
          limits[PLAN_LIMITS.PROJECTED_MOVEMENTS] || 0
        ));

        return limitStatuses;
      })
    );
  }

  /**
   * Obtiene los límites que están cerca de alcanzarse (más del 80% usado)
   */
  getNearLimitStatuses(): Observable<PlanLimitStatus[]> {
    return this.getAllLimitStatuses().pipe(
      map(statuses => statuses.filter(status => 
        !status.isUnlimited && status.percentageUsed >= 80
      ))
    );
  }

  /**
   * Obtiene los límites que han sido alcanzados
   */
  getReachedLimitStatuses(): Observable<PlanLimitStatus[]> {
    return this.getAllLimitStatuses().pipe(
      map(statuses => statuses.filter(status => 
        !status.isUnlimited && status.remaining === 0
      ))
    );
  }

  /**
   * Verifica si el usuario necesita actualizar su plan
   */
  needsPlanUpgrade(): Observable<boolean> {
    return this.getReachedLimitStatuses().pipe(
      map(reachedLimits => reachedLimits.length > 0)
    );
  }

  /**
   * Obtiene el progreso general del uso del plan
   */
  getOverallPlanProgress(): Observable<number> {
    return this.getAllLimitStatuses().pipe(
      map(statuses => {
        const limitedStatuses = statuses.filter(status => !status.isUnlimited);
        if (limitedStatuses.length === 0) return 0;
        
        const totalPercentage = limitedStatuses.reduce((sum, status) => 
          sum + status.percentageUsed, 0
        );
        return totalPercentage / limitedStatuses.length;
      })
    );
  }

  /**
   * Obtiene el límite más crítico (el que está más cerca de alcanzarse)
   */
  getMostCriticalLimit(): Observable<PlanLimitStatus | null> {
    return this.getAllLimitStatuses().pipe(
      map(statuses => {
        const limitedStatuses = statuses.filter(status => !status.isUnlimited);
        if (limitedStatuses.length === 0) return null;
        
        return limitedStatuses.reduce((mostCritical, current) => 
          current.percentageUsed > mostCritical.percentageUsed ? current : mostCritical
        );
      })
    );
  }

  /**
   * Crea un objeto PlanLimitStatus
   */
  private createLimitStatus(
    limitKey: string, 
    currentUsage: number, 
    limit: number
  ): PlanLimitStatus {
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
  }

  /**
   * Verifica si un valor representa un límite ilimitado
   */
  private isUnlimited(value: number): boolean {
    return value === -1;
  }

  /**
   * Obtiene el color CSS para el progreso de un límite
   */
  getProgressColor(percentageUsed: number): string {
    if (percentageUsed >= 90) return 'var(--color-error)'; // Rojo
    if (percentageUsed >= 75) return 'var(--color-warning)'; // Amarillo
    return 'var(--color-success)'; // Verde
  }

  /**
   * Obtiene el icono para el estado de un límite
   */
  getLimitIcon(limitStatus: PlanLimitStatus): string {
    if (limitStatus.isUnlimited) return 'infinity';
    if (limitStatus.remaining === 0) return 'block';
    if (limitStatus.percentageUsed >= 80) return 'warning';
    return 'check_circle';
  }

  /**
   * Obtiene el mensaje para el estado de un límite
   */
  getLimitMessage(limitStatus: PlanLimitStatus): string {
    if (limitStatus.isUnlimited) {
      return 'Ilimitado';
    }
    
    if (limitStatus.remaining === 0) {
      return 'Límite alcanzado';
    }
    
    if (limitStatus.percentageUsed >= 80) {
      return `Quedan ${limitStatus.remaining}`;
    }
    
    return `${limitStatus.currentUsage} de ${limitStatus.limit}`;
  }

  /**
   * Obtiene la clase CSS para el estado de un límite
   */
  getLimitStatusClass(limitStatus: PlanLimitStatus): string {
    if (limitStatus.isUnlimited) return 'unlimited';
    if (limitStatus.remaining === 0) return 'reached';
    if (limitStatus.percentageUsed >= 80) return 'warning';
    return 'normal';
  }
} 