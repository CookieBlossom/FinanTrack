import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { PlanUtilsService } from './plan-utils.service';
import { PlanLimitStatus } from '../../models/plan.model';

export interface PlanNotification {
  id: string;
  type: 'warning' | 'error' | 'info';
  title: string;
  message: string;
  action?: {
    text: string;
    route: string;
  };
  dismissible: boolean;
  timestamp: Date;
}

@Injectable({
  providedIn: 'root'
})
export class PlanNotificationsService {
  private notificationsSubject = new BehaviorSubject<PlanNotification[]>([]);
  notifications$ = this.notificationsSubject.asObservable();

  constructor(private planUtilsService: PlanUtilsService) {
    this.initializeNotifications();
  }

  /**
   * Inicializa las notificaciones monitoreando los límites
   */
  private initializeNotifications(): void {
    // Monitorear límites alcanzados
    this.planUtilsService.getReachedLimitStatuses().subscribe(
      reachedLimits => {
        reachedLimits.forEach(limit => {
          this.addLimitReachedNotification(limit);
        });
      }
    );

    // Monitorear límites cerca de alcanzarse
    this.planUtilsService.getNearLimitStatuses().subscribe(
      nearLimits => {
        nearLimits.forEach(limit => {
          if (limit.percentageUsed >= 90) {
            this.addLimitWarningNotification(limit);
          }
        });
      }
    );
  }

  /**
   * Agrega una notificación de límite alcanzado
   */
  private addLimitReachedNotification(limit: PlanLimitStatus): void {
    const notification: PlanNotification = {
      id: `limit-reached-${limit.limitKey}`,
      type: 'error',
      title: 'Límite alcanzado',
      message: `Has alcanzado el límite de ${this.getLimitDisplayName(limit.limitKey)}. Actualiza tu plan para continuar.`,
      action: {
        text: 'Ver Planes',
        route: '/plans'
      },
      dismissible: true,
      timestamp: new Date()
    };

    this.addNotification(notification);
  }

  /**
   * Agrega una notificación de advertencia de límite
   */
  private addLimitWarningNotification(limit: PlanLimitStatus): void {
    const notification: PlanNotification = {
      id: `limit-warning-${limit.limitKey}`,
      type: 'warning',
      title: 'Límite casi alcanzado',
      message: `Te quedan ${limit.remaining} ${this.getLimitDisplayName(limit.limitKey)}. Considera actualizar tu plan.`,
      action: {
        text: 'Ver Planes',
        route: '/plans'
      },
      dismissible: true,
      timestamp: new Date()
    };

    this.addNotification(notification);
  }

  /**
   * Agrega una notificación personalizada
   */
  addNotification(notification: PlanNotification): void {
    const currentNotifications = this.notificationsSubject.value;
    
    // Evitar duplicados
    const exists = currentNotifications.find(n => n.id === notification.id);
    if (exists) {
      return;
    }

    const updatedNotifications = [...currentNotifications, notification];
    this.notificationsSubject.next(updatedNotifications);
  }

  /**
   * Elimina una notificación
   */
  removeNotification(notificationId: string): void {
    const currentNotifications = this.notificationsSubject.value;
    const updatedNotifications = currentNotifications.filter(n => n.id !== notificationId);
    this.notificationsSubject.next(updatedNotifications);
  }

  /**
   * Limpia todas las notificaciones
   */
  clearAllNotifications(): void {
    this.notificationsSubject.next([]);
  }

  /**
   * Obtiene las notificaciones actuales
   */
  getNotifications(): PlanNotification[] {
    return this.notificationsSubject.value;
  }

  /**
   * Obtiene el número de notificaciones no leídas
   */
  getUnreadCount(): Observable<number> {
    return this.notifications$.pipe(
      map(notifications => notifications.length)
    );
  }

  /**
   * Obtiene el nombre legible de un límite
   */
  private getLimitDisplayName(limitKey: string): string {
    const displayNames: Record<string, string> = {
      'manual_movements': 'movimientos manuales',
      'manual_cards': 'tarjetas manuales',
      'custom_categories': 'categorías personalizadas',
      'cartola_movements': 'movimientos de cartola',
      'scraper_tasks': 'tareas de scraper',
      'projected_movements': 'movimientos proyectados'
    };
    return displayNames[limitKey] || limitKey;
  }

  /**
   * Agrega una notificación de upgrade recomendado
   */
  addUpgradeRecommendationNotification(): void {
    const notification: PlanNotification = {
      id: 'upgrade-recommendation',
      type: 'info',
      title: 'Mejora tu experiencia',
      message: 'Descubre todas las funcionalidades avanzadas con nuestros planes premium.',
      action: {
        text: 'Ver Planes',
        route: '/plans'
      },
      dismissible: true,
      timestamp: new Date()
    };

    this.addNotification(notification);
  }

  /**
   * Agrega una notificación de funcionalidad no disponible
   */
  addFeatureNotAvailableNotification(featureName: string): void {
    const notification: PlanNotification = {
      id: `feature-not-available-${featureName}`,
      type: 'warning',
      title: 'Funcionalidad no disponible',
      message: `${featureName} no está disponible en tu plan actual. Actualiza para acceder.`,
      action: {
        text: 'Ver Planes',
        route: '/plans'
      },
      dismissible: true,
      timestamp: new Date()
    };

    this.addNotification(notification);
  }

  /**
   * Agrega una notificación de pago exitoso
   */
  addPaymentSuccessNotification(planName: string): void {
    const notification: PlanNotification = {
      id: 'payment-success',
      type: 'info',
      title: '¡Plan actualizado!',
      message: `Tu plan ha sido actualizado exitosamente a ${planName}. Disfruta de todas las funcionalidades.`,
      dismissible: true,
      timestamp: new Date()
    };

    this.addNotification(notification);
  }
} 