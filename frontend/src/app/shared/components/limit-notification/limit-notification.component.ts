import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

export interface LimitNotificationData {
  type: 'warning' | 'error' | 'info';
  title: string;
  message: string;
  limit: number;
  current: number;
  showUpgradeButton?: boolean;
}

@Component({
  selector: 'app-limit-notification',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule],
  template: `
    <div class="limit-notification" [ngClass]="data.type">
      <div class="notification-header">
        <mat-icon [ngClass]="data.type">{{ getIcon() }}</mat-icon>
        <span class="title">{{ data.title }}</span>
        <button 
          mat-icon-button 
          class="close-btn" 
          (click)="onClose.emit()">
          <mat-icon>close</mat-icon>
        </button>
      </div>
      
      <div class="notification-content">
        <p class="message">{{ data.message }}</p>
        
        <div class="limit-info">
          <div class="limit-bar">
            <div 
              class="limit-progress" 
              [style.width.%]="getProgressPercentage()">
            </div>
          </div>
          <span class="limit-text">{{ data.current }}/{{ data.limit }}</span>
        </div>
        
        <button 
          *ngIf="data.showUpgradeButton"
          mat-raised-button 
          color="primary" 
          class="upgrade-btn"
          (click)="upgradePlan()">
          <mat-icon>upgrade</mat-icon>
          Actualizar Plan
        </button>
      </div>
    </div>
  `,
  styles: [`
    .limit-notification {
      border-radius: 8px;
      padding: 16px;
      margin: 8px 0;
      border-left: 4px solid;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .limit-notification.warning {
      background: #fff3cd;
      border-left-color: #ffc107;
      color: #856404;
    }

    .limit-notification.error {
      background: #f8d7da;
      border-left-color: #dc3545;
      color: #721c24;
    }

    .limit-notification.info {
      background: #d1ecf1;
      border-left-color: #17a2b8;
      color: #0c5460;
    }

    .notification-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
    }

    .notification-header mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .notification-header .title {
      font-weight: 600;
      flex: 1;
    }

    .close-btn {
      margin-left: auto;
    }

    .notification-content {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .message {
      margin: 0;
      font-size: 14px;
      line-height: 1.4;
    }

    .limit-info {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .limit-bar {
      flex: 1;
      height: 8px;
      background: rgba(0, 0, 0, 0.1);
      border-radius: 4px;
      overflow: hidden;
    }

    .limit-progress {
      height: 100%;
      background: var(--color-primary);
      border-radius: 4px;
      transition: width 0.3s ease;
    }

    .limit-text {
      font-size: 12px;
      font-weight: 500;
      min-width: 60px;
      text-align: right;
    }

    .upgrade-btn {
      align-self: flex-start;
      font-size: 12px;
      padding: 6px 12px;
      min-width: auto;
    }

    .upgrade-btn mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }
  `]
})
export class LimitNotificationComponent {
  @Input() data!: LimitNotificationData;
  @Output() onClose = new EventEmitter<void>();

  getIcon(): string {
    switch (this.data.type) {
      case 'warning': return 'warning';
      case 'error': return 'error';
      case 'info': return 'info';
      default: return 'info';
    }
  }

  getProgressPercentage(): number {
    return Math.min((this.data.current / this.data.limit) * 100, 100);
  }

  upgradePlan(): void {
    window.location.href = '/plans';
  }
} 