import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { PlanLimitAlertData, PlanLimitAlertResult } from '../../services/plan-limit-alert.service';
import { LimitDisplayPipe } from '../../pipes/limit-display.pipe';

@Component({
  selector: 'app-plan-limit-alert',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    LimitDisplayPipe
  ],
  template: `
    <div class="limit-alert-container">
      <!-- Header -->
      <div class="alert-header">
        <div class="alert-icon">
          <mat-icon>warning</mat-icon>
        </div>
        <h2 mat-dialog-title>{{ data.title }}</h2>
      </div>

      <!-- Content -->
      <div mat-dialog-content class="alert-content">
        <p class="alert-message">{{ data.message }}</p>
        
        <!-- Usage Progress -->
        <div class="usage-info">
          <div class="usage-header">
            <span class="usage-label">Uso actual:</span>
            <span class="usage-count">{{ data.currentUsage }} / {{ data.limit | limitDisplay }}</span>
          </div>
          <mat-progress-bar 
            [value]="getProgressValue()"
            color="warn"
            class="usage-progress">
          </mat-progress-bar>
          <div class="usage-percentage">
            {{ getUsagePercentage() }}% utilizado
          </div>
        </div>

        <!-- Plan Comparison -->
        <div class="plan-comparison">
          <h4>¿Qué incluyen los planes superiores?</h4>
          <div class="plan-features">
            <div class="feature-item">
              <mat-icon class="feature-icon">check_circle</mat-icon>
              <span>Más {{ data.featureName.toLowerCase() }}</span>
            </div>
            <div class="feature-item">
              <mat-icon class="feature-icon">check_circle</mat-icon>
              <span>Funcionalidades avanzadas</span>
            </div>
            <div class="feature-item">
              <mat-icon class="feature-icon">check_circle</mat-icon>
              <span>Soporte prioritario</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div mat-dialog-actions class="alert-actions">
        <button 
          mat-button 
          (click)="dismiss()"
          class="dismiss-button">
          Continuar con plan actual
        </button>
        <button 
          mat-raised-button 
          color="primary"
          (click)="upgradePlan()"
          class="upgrade-button">
          <mat-icon>upgrade</mat-icon>
          Ver Planes
        </button>
      </div>
    </div>
  `,
  styleUrls: ['./plan-limit-alert.component.css']
})
export class PlanLimitAlertComponent implements OnInit {

  constructor(
    public dialogRef: MatDialogRef<PlanLimitAlertComponent, PlanLimitAlertResult>,
    @Inject(MAT_DIALOG_DATA) public data: PlanLimitAlertData
  ) {}

  ngOnInit(): void {
    this.dialogRef.disableClose = false;
  }

  /**
   * Calcula el valor de la barra de progreso
   */
  getProgressValue(): number {
    if (this.data.limit === -1) return 0;
    return Math.min((this.data.currentUsage / this.data.limit) * 100, 100);
  }

  /**
   * Calcula el porcentaje de uso
   */
  getUsagePercentage(): string {
    if (this.data.limit === -1) return '0';
    return Math.min((this.data.currentUsage / this.data.limit) * 100, 100).toFixed(0);
  }

  dismiss(): void {
    this.dialogRef.close({ action: 'dismiss' });
  }

  upgradePlan(): void {
    this.dialogRef.close({ action: 'upgrade' });
  }
} 