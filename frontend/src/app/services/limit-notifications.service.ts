import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { PlanLimitsService, LimitCheck, PermissionCheck } from './plan-limits.service';

export interface LimitNotification {
  id: string;
  type: 'limit' | 'permission';
  title: string;
  message: string;
  featureName: string;
  limitCheck?: LimitCheck;
  permissionCheck?: PermissionCheck;
  timestamp: Date;
  dismissed: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class LimitNotificationsService {
  private notificationsSubject = new BehaviorSubject<LimitNotification[]>([]);
  notifications$ = this.notificationsSubject.asObservable();

  constructor(private planLimitsService: PlanLimitsService) {}

  /**
   * Verifica límites antes de una acción y muestra notificación si es necesario
   */
  checkLimitBeforeAction(
    action: 'create_movement' | 'create_card' | 'add_keywords' | 'upload_cartola' | 'use_scraper' | 'export_data',
    keywordsCount?: number
  ): Observable<{ canProceed: boolean; notification?: LimitNotification }> {
    switch (action) {
      case 'create_movement':
        return this.checkMovementLimit();
      case 'create_card':
        return this.checkCardLimit();
      case 'add_keywords':
        return this.checkKeywordsLimit(keywordsCount || 1);
      case 'upload_cartola':
        return this.checkCartolaPermission();
      case 'use_scraper':
        return this.checkScraperPermission();
      case 'export_data':
        return this.checkExportPermission();
      default:
        return new Observable(subscriber => {
          subscriber.next({ canProceed: true });
          subscriber.complete();
        });
    }
  }

  private checkMovementLimit(): Observable<{ canProceed: boolean; notification?: LimitNotification }> {
    return new Observable(subscriber => {
      this.planLimitsService.canCreateManualMovement().subscribe(check => {
        if (!check.canPerform) {
          const notification = this.createNotification(
            'limit',
            'Límite de Movimientos Alcanzado',
            check.reason || 'Has alcanzado el límite de movimientos manuales',
            'movimientos manuales',
            check
          );
          this.addNotification(notification);
          subscriber.next({ canProceed: false, notification });
        } else if (check.remaining !== undefined && check.remaining <= 5) {
          const notification = this.createNotification(
            'limit',
            'Límite Cerca',
            `Te quedan ${check.remaining} movimientos manuales. Considera actualizar tu plan.`,
            'movimientos manuales',
            check
          );
          this.addNotification(notification);
          subscriber.next({ canProceed: true, notification });
        } else {
          subscriber.next({ canProceed: true });
        }
        subscriber.complete();
      });
    });
  }

  private checkCardLimit(): Observable<{ canProceed: boolean; notification?: LimitNotification }> {
    return new Observable(subscriber => {
      this.planLimitsService.canCreateCard().subscribe(check => {
        if (!check.canPerform) {
          const notification = this.createNotification(
            'limit',
            'Límite de Tarjetas Alcanzado',
            check.reason || 'Has alcanzado el límite de tarjetas',
            'tarjetas',
            check
          );
          this.addNotification(notification);
          subscriber.next({ canProceed: false, notification });
        } else {
          subscriber.next({ canProceed: true });
        }
        subscriber.complete();
      });
    });
  }

  private checkKeywordsLimit(keywordsCount: number): Observable<{ canProceed: boolean; notification?: LimitNotification }> {
    return new Observable(subscriber => {
      this.planLimitsService.canAddKeywords(keywordsCount).subscribe(check => {
        if (!check.canPerform) {
          const notification = this.createNotification(
            'limit',
            'Límite de Palabras Clave Alcanzado',
            check.reason || 'Has alcanzado el límite de palabras clave por categoría',
            'palabras clave por categoría',
            check
          );
          this.addNotification(notification);
          subscriber.next({ canProceed: false, notification });
        } else {
          subscriber.next({ canProceed: true });
        }
        subscriber.complete();
      });
    });
  }

  private checkCartolaPermission(): Observable<{ canProceed: boolean; notification?: LimitNotification }> {
    return new Observable(subscriber => {
      this.planLimitsService.canUploadCartola().subscribe(check => {
        if (!check.hasPermission) {
          const notification = this.createNotification(
            'permission',
            'Funcionalidad No Disponible',
            check.reason || 'Tu plan no incluye subida de cartolas',
            'subida de cartolas',
            undefined,
            check
          );
          this.addNotification(notification);
          subscriber.next({ canProceed: false, notification });
        } else {
          subscriber.next({ canProceed: true });
        }
        subscriber.complete();
      });
    });
  }

  private checkScraperPermission(): Observable<{ canProceed: boolean; notification?: LimitNotification }> {
    return new Observable(subscriber => {
      this.planLimitsService.canUseScraper().subscribe(check => {
        if (!check.hasPermission) {
          const notification = this.createNotification(
            'permission',
            'Funcionalidad No Disponible',
            check.reason || 'Tu plan no incluye acceso al scraper',
            'acceso al scraper',
            undefined,
            check
          );
          this.addNotification(notification);
          subscriber.next({ canProceed: false, notification });
        } else {
          subscriber.next({ canProceed: true });
        }
        subscriber.complete();
      });
    });
  }

  private checkExportPermission(): Observable<{ canProceed: boolean; notification?: LimitNotification }> {
    return new Observable(subscriber => {
      this.planLimitsService.canExportData().subscribe(check => {
        if (!check.hasPermission) {
          const notification = this.createNotification(
            'permission',
            'Funcionalidad No Disponible',
            check.reason || 'Tu plan no incluye exportación de datos',
            'exportación de datos',
            undefined,
            check
          );
          this.addNotification(notification);
          subscriber.next({ canProceed: false, notification });
        } else {
          subscriber.next({ canProceed: true });
        }
        subscriber.complete();
      });
    });
  }

  private createNotification(
    type: 'limit' | 'permission',
    title: string,
    message: string,
    featureName: string,
    limitCheck?: LimitCheck,
    permissionCheck?: PermissionCheck
  ): LimitNotification {
    return {
      id: this.generateId(),
      type,
      title,
      message,
      featureName,
      limitCheck,
      permissionCheck,
      timestamp: new Date(),
      dismissed: false
    };
  }

  private addNotification(notification: LimitNotification): void {
    const currentNotifications = this.notificationsSubject.value;
    const updatedNotifications = [notification, ...currentNotifications].slice(0, 5); // Máximo 5 notificaciones
    this.notificationsSubject.next(updatedNotifications);
  }

  /**
   * Marca una notificación como descartada
   */
  dismissNotification(notificationId: string): void {
    const currentNotifications = this.notificationsSubject.value;
    const updatedNotifications = currentNotifications.map(notification =>
      notification.id === notificationId
        ? { ...notification, dismissed: true }
        : notification
    );
    this.notificationsSubject.next(updatedNotifications);
  }

  /**
   * Elimina una notificación completamente
   */
  removeNotification(notificationId: string): void {
    const currentNotifications = this.notificationsSubject.value;
    const updatedNotifications = currentNotifications.filter(
      notification => notification.id !== notificationId
    );
    this.notificationsSubject.next(updatedNotifications);
  }

  /**
   * Limpia todas las notificaciones
   */
  clearAllNotifications(): void {
    this.notificationsSubject.next([]);
  }

  /**
   * Obtiene las notificaciones activas (no descartadas)
   */
  getActiveNotifications(): Observable<LimitNotification[]> {
    return this.notifications$.pipe(
      map(notifications => notifications.filter(n => !n.dismissed))
    );
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
} 