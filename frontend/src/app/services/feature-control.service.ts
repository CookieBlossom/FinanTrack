import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { PlanService } from './plan.service';
import { PLAN_PERMISSIONS, PLAN_NAMES } from '../models/plan.model';

export interface FeatureControl {
  canUseCartola: boolean;
  canUseScraper: boolean;
  canExportData: boolean;
  canUseAdvancedCategorization: boolean;
  canUseAutomatedCategorization: boolean;
  canUseApi: boolean;
  canUseExecutiveDashboard: boolean;
  hasPrioritySupport: boolean;
  hasEmailSupport: boolean;
  planName: string;
  planDisplayName: string;
}

@Injectable({
  providedIn: 'root'
})
export class FeatureControlService {
  private featureControlSubject = new BehaviorSubject<FeatureControl | null>(null);
  featureControl$ = this.featureControlSubject.asObservable();

  constructor(
    private authService: AuthService,
    private planService: PlanService
  ) {
    this.initializeFeatureControl();
  }

  private initializeFeatureControl(): void {
    // Combinar autenticación y plan para determinar funcionalidades
    combineLatest([
      this.authService.isAuthenticated$,
      this.planService.currentUserPlan$
    ]).pipe(
      switchMap(([isAuthenticated, userPlan]) => {
        if (!isAuthenticated || !userPlan) {
          return this.getDefaultFeatureControl();
        }
        return this.buildFeatureControl(userPlan);
      })
    ).subscribe(featureControl => {
      this.featureControlSubject.next(featureControl);
    });
  }

  private getDefaultFeatureControl(): Observable<FeatureControl> {
    return new Observable(subscriber => {
      subscriber.next({
        canUseCartola: false,
        canUseScraper: false,
        canExportData: false,
        canUseAdvancedCategorization: false,
        canUseAutomatedCategorization: false,
        canUseApi: false,
        canUseExecutiveDashboard: false,
        hasPrioritySupport: false,
        hasEmailSupport: false,
        planName: PLAN_NAMES.FREE,
        planDisplayName: 'Gratis'
      });
      subscriber.complete();
    });
  }

  private buildFeatureControl(userPlan: any): Observable<FeatureControl> {
    return this.planService.getPlanPermissions().pipe(
      map(permissions => {
        const planName = userPlan.planName || PLAN_NAMES.FREE;
        const planDisplayName = this.planService.getPlanDisplayName(planName);

        return {
          canUseCartola: permissions.includes(PLAN_PERMISSIONS.CARTOLA_UPLOAD),
          canUseScraper: permissions.includes(PLAN_PERMISSIONS.SCRAPER_ACCESS),
          canExportData: permissions.includes(PLAN_PERMISSIONS.EXPORT_DATA),
          canUseAdvancedCategorization: permissions.includes(PLAN_PERMISSIONS.ADVANCED_CATEGORIZATION),
          canUseAutomatedCategorization: permissions.includes(PLAN_PERMISSIONS.AUTOMATED_CATEGORIZATION),
          canUseApi: permissions.includes(PLAN_PERMISSIONS.API_ACCESS),
          canUseExecutiveDashboard: permissions.includes(PLAN_PERMISSIONS.EXECUTIVE_DASHBOARD),
          hasPrioritySupport: permissions.includes(PLAN_PERMISSIONS.PRIORITY_SUPPORT),
          hasEmailSupport: permissions.includes(PLAN_PERMISSIONS.EMAIL_SUPPORT),
          planName,
          planDisplayName
        };
      })
    );
  }

  /**
   * Verifica si el usuario puede usar una funcionalidad específica
   */
  canUseFeature(feature: keyof Omit<FeatureControl, 'planName' | 'planDisplayName'>): Observable<boolean> {
    return this.featureControl$.pipe(
      map(control => control?.[feature] || false)
    );
  }

  /**
   * Obtiene el control de funcionalidades actual
   */
  getFeatureControl(): FeatureControl | null {
    return this.featureControlSubject.value;
  }

  /**
   * Obtiene el nombre del plan actual
   */
  getCurrentPlanName(): string {
    return this.featureControlSubject.value?.planName || PLAN_NAMES.FREE;
  }

  /**
   * Obtiene el nombre de visualización del plan actual
   */
  getCurrentPlanDisplayName(): string {
    return this.featureControlSubject.value?.planDisplayName || 'Gratis';
  }

  /**
   * Verifica si el usuario tiene un plan específico o superior
   */
  hasPlanOrHigher(requiredPlan: string): Observable<boolean> {
    return this.featureControl$.pipe(
      map(control => {
        if (!control) return false;
        
        const planHierarchy = {
          [PLAN_NAMES.FREE]: 0,
          [PLAN_NAMES.BASIC]: 1,
          [PLAN_NAMES.PREMIUM]: 2,
          [PLAN_NAMES.PRO]: 3
        };

        const currentPlanLevel = planHierarchy[control.planName as keyof typeof planHierarchy] || 0;
        const requiredPlanLevel = planHierarchy[requiredPlan as keyof typeof planHierarchy] || 0;

        return currentPlanLevel >= requiredPlanLevel;
      })
    );
  }

  /**
   * Refresca el control de funcionalidades
   */
  refreshFeatureControl(): void {
    this.initializeFeatureControl();
  }

  /**
   * Verifica si el usuario puede usar cartolas
   */
  canUseCartola(): Observable<boolean> {
    return this.canUseFeature('canUseCartola');
  }

  /**
   * Verifica si el usuario puede usar scraper
   */
  canUseScraper(): Observable<boolean> {
    return this.canUseFeature('canUseScraper');
  }

  /**
   * Verifica si el usuario puede exportar datos
   */
  canExportData(): Observable<boolean> {
    return this.canUseFeature('canExportData');
  }

  /**
   * Verifica si el usuario puede usar categorización avanzada
   */
  canUseAdvancedCategorization(): Observable<boolean> {
    return this.canUseFeature('canUseAdvancedCategorization');
  }

  /**
   * Verifica si el usuario puede usar categorización automática
   */
  canUseAutomatedCategorization(): Observable<boolean> {
    return this.canUseFeature('canUseAutomatedCategorization');
  }

  /**
   * Verifica si el usuario puede usar API
   */
  canUseApi(): Observable<boolean> {
    return this.canUseFeature('canUseApi');
  }

  /**
   * Verifica si el usuario puede usar dashboard ejecutivo
   */
  canUseExecutiveDashboard(): Observable<boolean> {
    return this.canUseFeature('canUseExecutiveDashboard');
  }

  /**
   * Verifica si el usuario tiene soporte prioritario
   */
  hasPrioritySupport(): Observable<boolean> {
    return this.canUseFeature('hasPrioritySupport');
  }

  /**
   * Verifica si el usuario tiene soporte por email
   */
  hasEmailSupport(): Observable<boolean> {
    return this.canUseFeature('hasEmailSupport');
  }
} 