import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LimitCheck, PermissionCheck } from '../../../services/plan-limits.service';

@Component({
  selector: 'app-limit-alert',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="limit-alert" *ngIf="showAlert" [class]="alertType">
      <div class="alert-content">
        <div class="alert-icon">
          <i class="fas" [class]="iconClass"></i>
        </div>
        <div class="alert-message">
          <h4>{{ alertTitle }}</h4>
          <p>{{ alertMessage }}</p>
          <div class="alert-details" *ngIf="showDetails">
            <span class="usage-info">
              {{ used }} / {{ limit }} {{ featureName }}
            </span>
            <span class="remaining-info" *ngIf="remaining !== undefined">
              ({{ remaining }} restantes)
            </span>
          </div>
        </div>
        <div class="alert-actions">
          <button 
            class="upgrade-btn" 
            (click)="onUpgrade.emit()"
            *ngIf="showUpgradeButton">
            Actualizar Plan
          </button>
          <button 
            class="close-btn" 
            (click)="onClose.emit()">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .limit-alert {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 1000;
      max-width: 400px;
      animation: slideIn 0.3s ease-out;
    }

    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    .alert-content {
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      padding: 16px;
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }

    .alert-icon {
      flex-shrink: 0;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 12px;
    }

    .alert-message {
      flex: 1;
      min-width: 0;
    }

    .alert-message h4 {
      margin: 0 0 4px 0;
      font-size: 14px;
      font-weight: 600;
    }

    .alert-message p {
      margin: 0 0 8px 0;
      font-size: 13px;
      color: #666;
      line-height: 1.4;
    }

    .alert-details {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .usage-info {
      font-size: 12px;
      color: #888;
      font-weight: 500;
    }

    .remaining-info {
      font-size: 11px;
      color: #999;
    }

    .alert-actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
      align-items: flex-end;
    }

    .upgrade-btn {
      background: #8B2635;
      color: white;
      border: none;
      padding: 6px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
      white-space: nowrap;
    }

    .upgrade-btn:hover {
      background: #6B1E2A;
    }

    .close-btn {
      background: none;
      border: none;
      color: #999;
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      transition: background 0.2s;
    }

    .close-btn:hover {
      background: #f5f5f5;
    }

    /* Tipos de alerta */
    .limit-alert.warning .alert-icon {
      background: #FF9800;
    }

    .limit-alert.danger .alert-icon {
      background: #F44336;
    }

    .limit-alert.permission .alert-icon {
      background: #2196F3;
    }

    .limit-alert.info .alert-icon {
      background: #4CAF50;
    }
  `]
})
export class LimitAlertComponent {
  @Input() limitCheck?: LimitCheck;
  @Input() permissionCheck?: PermissionCheck;
  @Input() featureName: string = '';
  @Output() onUpgrade = new EventEmitter<void>();
  @Output() onClose = new EventEmitter<void>();

  get showAlert(): boolean {
    return !!(this.limitCheck || this.permissionCheck);
  }

  get alertType(): string {
    if (this.permissionCheck && !this.permissionCheck.hasPermission) {
      return 'permission';
    }
    
    if (this.limitCheck) {
      if (!this.limitCheck.canPerform) {
        return 'danger';
      }
      if (this.limitCheck.remaining !== undefined && this.limitCheck.remaining <= 5) {
        return 'warning';
      }
    }
    
    return 'info';
  }

  get alertTitle(): string {
    if (this.permissionCheck && !this.permissionCheck.hasPermission) {
      return 'Funcionalidad No Disponible';
    }
    
    if (this.limitCheck && !this.limitCheck.canPerform) {
      return 'Límite Alcanzado';
    }
    
    if (this.limitCheck && this.limitCheck.remaining !== undefined && this.limitCheck.remaining <= 5) {
      return 'Límite Cerca';
    }
    
    return 'Información';
  }

  get alertMessage(): string {
    if (this.permissionCheck && !this.permissionCheck.hasPermission) {
      return this.permissionCheck.reason || 'Tu plan no incluye esta funcionalidad';
    }
    
    if (this.limitCheck && !this.limitCheck.canPerform) {
      return this.limitCheck.reason || `Has alcanzado el límite de ${this.featureName}`;
    }
    
    if (this.limitCheck && this.limitCheck.remaining !== undefined && this.limitCheck.remaining <= 5) {
      return `Te quedan ${this.limitCheck.remaining} ${this.featureName}. Considera actualizar tu plan.`;
    }
    
    return 'Información del plan';
  }

  get iconClass(): string {
    switch (this.alertType) {
      case 'danger':
        return 'fa-exclamation-triangle';
      case 'warning':
        return 'fa-exclamation-circle';
      case 'permission':
        return 'fa-lock';
      default:
        return 'fa-info-circle';
    }
  }

  get showDetails(): boolean {
    return !!(this.limitCheck && this.limitCheck.limit !== undefined);
  }

  get showUpgradeButton(): boolean {
    return this.alertType === 'danger' || this.alertType === 'permission';
  }

  get used(): number {
    return this.limitCheck?.used || 0;
  }

  get limit(): number {
    return this.limitCheck?.limit || 0;
  }

  get remaining(): number | undefined {
    return this.limitCheck?.remaining;
  }
} 