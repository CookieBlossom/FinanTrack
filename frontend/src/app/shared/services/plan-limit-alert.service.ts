import { Injectable } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { PlanLimitAlertComponent } from '../components/plan-limit-alert/plan-limit-alert.component';

export interface PlanLimitAlertData {
  title: string;
  message: string;
  limitType: string;
  currentUsage: number;
  limit: number;
  featureName: string;
}

export interface PlanLimitAlertResult {
  action: 'upgrade' | 'dismiss';
}

@Injectable({
  providedIn: 'root'
})
export class PlanLimitAlertService {

  constructor(private dialog: MatDialog) {}

  /**
   * Muestra una alerta modal cuando se alcanza un límite del plan
   */
  showLimitAlert(data: PlanLimitAlertData): Observable<PlanLimitAlertResult> {
    const dialogRef: MatDialogRef<PlanLimitAlertComponent, PlanLimitAlertResult> = 
      this.dialog.open(PlanLimitAlertComponent, {
        width: '500px',
        maxWidth: '90vw',
        disableClose: false,
        data: data,
        panelClass: 'plan-limit-alert-dialog'
      });

    return dialogRef.afterClosed().pipe(
      map((result: PlanLimitAlertResult | undefined) => result || { action: 'dismiss' })
    );
  }

  /**
   * Muestra una alerta específica para límite de tarjetas
   */
  showCardLimitAlert(currentUsage: number, limit: number): Observable<PlanLimitAlertResult> {
    return this.showLimitAlert({
      title: 'Límite de Tarjetas Alcanzado',
      message: `No puedes agregar más tarjetas. Has alcanzado el límite de ${limit} tarjetas de tu plan actual.`,
      limitType: 'cards',
      currentUsage,
      limit,
      featureName: 'Tarjetas'
    });
  }

  /**
   * Muestra una alerta específica para límite de movimientos
   */
  showMovementLimitAlert(currentUsage: number, limit: number): Observable<PlanLimitAlertResult> {
    return this.showLimitAlert({
      title: 'Límite de Movimientos Alcanzado',
      message: `No puedes agregar más movimientos. Has alcanzado el límite de ${limit} movimientos de tu plan actual.`,
      limitType: 'movements',
      currentUsage,
      limit,
      featureName: 'Movimientos'
    });
  }

  /**
   * Muestra una alerta específica para límite de palabras clave
   */
  showKeywordLimitAlert(currentUsage: number, limit: number): Observable<PlanLimitAlertResult> {
    return this.showLimitAlert({
      title: 'Límite de Palabras Clave Alcanzado',
      message: `No puedes agregar más palabras clave. Has alcanzado el límite de ${limit} palabras clave por categoría de tu plan actual.`,
      limitType: 'keywords',
      currentUsage,
      limit,
      featureName: 'Palabras Clave'
    });
  }

  /**
   * Muestra una alerta específica para límite de cartolas
   */
  showCartolaLimitAlert(currentUsage: number, limit: number): Observable<PlanLimitAlertResult> {
    return this.showLimitAlert({
      title: 'Límite de Cartolas Alcanzado',
      message: `No puedes agregar más cartolas. Has alcanzado el límite de ${limit} cartolas por mes de tu plan actual.`,
      limitType: 'cartolas',
      currentUsage,
      limit,
      featureName: 'Cartolas'
    });
  }

  /**
   * Muestra una alerta específica para límite de scraper
   */
  showScraperLimitAlert(currentUsage: number, limit: number): Observable<PlanLimitAlertResult> {
    return this.showLimitAlert({
      title: 'Límite de Sincronizaciones Alcanzado',
      message: `No puedes realizar más sincronizaciones automáticas. Has alcanzado el límite de ${limit} sincronizaciones por mes de tu plan actual.`,
      limitType: 'scraper',
      currentUsage,
      limit,
      featureName: 'Sincronizaciones'
    });
  }

  /**
   * Muestra una alerta genérica para cualquier límite
   */
  showGenericLimitAlert(featureName: string, currentUsage: number, limit: number): Observable<PlanLimitAlertResult> {
    return this.showLimitAlert({
      title: `Límite de ${featureName} Alcanzado`,
      message: `No puedes agregar más ${featureName.toLowerCase()}. Has alcanzado el límite de ${limit} ${featureName.toLowerCase()} de tu plan actual.`,
      limitType: 'generic',
      currentUsage,
      limit,
      featureName
    });
  }
} 