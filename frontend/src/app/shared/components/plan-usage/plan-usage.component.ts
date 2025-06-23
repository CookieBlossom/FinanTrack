import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { PlanLimitsService } from '../../../services/plan-limits.service';
import { PlanService } from '../../../services/plan.service';
import { PLAN_LIMITS, PlanUsage } from '../../../models/plan.model';

@Component({
  selector: 'app-plan-usage',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="plan-usage-container" *ngIf="currentUsage">
      <div class="usage-header">
        <h3>Uso de tu Plan</h3>
        <span class="plan-name">{{ currentPlanName }}</span>
      </div>
      
      <div class="usage-items">
        <div class="usage-item" *ngFor="let limitKey of limitKeys">
          <div class="usage-info">
            <span class="usage-label">{{ getLimitDisplayName(limitKey) }}</span>
            <span class="usage-count">
              {{ getUsageText(limitKey) }}
            </span>
          </div>
          
          <div class="usage-bar" *ngIf="!isUnlimited(limitKey)">
            <div class="progress-bar">
              <div 
                class="progress-fill" 
                [class]="getStatusClass(limitKey)"
                [style.width.%]="getUsagePercentage(limitKey)">
              </div>
            </div>
            <span class="usage-percentage">{{ getUsagePercentage(limitKey) | number:'1.0-0' }}%</span>
          </div>
          
          <div class="usage-unlimited" *ngIf="isUnlimited(limitKey)">
            <span class="unlimited-badge">Ilimitado</span>
          </div>
        </div>
      </div>
      
      <div class="usage-actions">
        <button 
          class="upgrade-btn" 
          (click)="upgradePlan()"
          *ngIf="showUpgradeButton">
          Actualizar Plan
        </button>
        <button 
          class="refresh-btn" 
          (click)="refreshUsage()">
          Actualizar
        </button>
      </div>
    </div>
  `,
  styles: [`
    .plan-usage-container {
      background: white;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      margin: 20px 0;
    }

    .usage-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 1px solid #e0e0e0;
    }

    .usage-header h3 {
      margin: 0;
      color: #333;
      font-size: 18px;
      font-weight: 600;
    }

    .plan-name {
      background: #8B2635;
      color: white;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 500;
    }

    .usage-items {
      display: flex;
      flex-direction: column;
      gap: 15px;
    }

    .usage-item {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .usage-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .usage-label {
      font-size: 14px;
      color: #555;
      font-weight: 500;
    }

    .usage-count {
      font-size: 12px;
      color: #666;
      font-weight: 400;
    }

    .usage-bar {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .progress-bar {
      flex: 1;
      height: 8px;
      background: #f0f0f0;
      border-radius: 4px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      transition: width 0.3s ease;
      border-radius: 4px;
    }

    .progress-fill.normal {
      background: #4CAF50;
    }

    .progress-fill.warning {
      background: #FF9800;
    }

    .progress-fill.danger {
      background: #F44336;
    }

    .usage-percentage {
      font-size: 12px;
      color: #666;
      min-width: 35px;
      text-align: right;
    }

    .usage-unlimited {
      display: flex;
      justify-content: flex-end;
    }

    .unlimited-badge {
      background: #4CAF50;
      color: white;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 10px;
      font-weight: 500;
    }

    .usage-actions {
      display: flex;
      gap: 10px;
      margin-top: 20px;
      padding-top: 15px;
      border-top: 1px solid #e0e0e0;
    }

    .upgrade-btn {
      background: #8B2635;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
    }

    .upgrade-btn:hover {
      background: #6B1E2A;
    }

    .refresh-btn {
      background: #f5f5f5;
      color: #666;
      border: 1px solid #ddd;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
      transition: background 0.2s;
    }

    .refresh-btn:hover {
      background: #e8e8e8;
    }
  `]
})
export class PlanUsageComponent implements OnInit, OnDestroy {
  currentUsage: PlanUsage | null = null;
  currentPlanName: string = '';
  limitKeys: string[] = [
    PLAN_LIMITS.MANUAL_MOVEMENTS,
    PLAN_LIMITS.MAX_CARDS,
    PLAN_LIMITS.KEYWORDS_PER_CATEGORY,
    PLAN_LIMITS.CARTOLA_MOVEMENTS,
    PLAN_LIMITS.SCRAPER_MOVEMENTS
  ];
  
  private subscriptions: Subscription[] = [];

  constructor(
    private planLimitsService: PlanLimitsService,
    private planService: PlanService
  ) {}

  ngOnInit(): void {
    this.subscriptions.push(
      this.planLimitsService.currentUsage$.subscribe(usage => {
        this.currentUsage = usage;
      })
    );

    this.subscriptions.push(
      this.planService.currentUserPlan$.subscribe(plan => {
        if (plan) {
          this.currentPlanName = this.planService.getPlanDisplayName(plan.planName);
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  getLimitDisplayName(limitKey: string): string {
    return this.planService.getLimitDisplayName(limitKey);
  }

  getUsageText(limitKey: string): string {
    if (!this.currentUsage || !this.currentUsage[limitKey]) {
      return '0 / 0';
    }

    const usage = this.currentUsage[limitKey];
    if (usage.limit === -1) {
      return `${usage.used} / ∞`;
    }

    return `${usage.used} / ${usage.limit}`;
  }

  getUsagePercentage(limitKey: string): number {
    if (!this.currentUsage || !this.currentUsage[limitKey]) {
      return 0;
    }

    const usage = this.currentUsage[limitKey];
    if (usage.limit === -1 || usage.limit === 0) {
      return 0;
    }

    return Math.min((usage.used / usage.limit) * 100, 100);
  }

  isUnlimited(limitKey: string): boolean {
    if (!this.currentUsage || !this.currentUsage[limitKey]) {
      return false;
    }

    return this.currentUsage[limitKey].limit === -1;
  }

  getStatusClass(limitKey: string): string {
    const percentage = this.getUsagePercentage(limitKey);
    if (percentage >= 90) return 'danger';
    if (percentage >= 75) return 'warning';
    return 'normal';
  }

  get showUpgradeButton(): boolean {
    if (!this.currentUsage) return false;

    // Mostrar botón de actualización si algún límite está al 90% o más
    return this.limitKeys.some(key => {
      const usage = this.currentUsage![key];
      if (!usage || usage.limit === -1) return false;
      return (usage.used / usage.limit) >= 0.9;
    });
  }

  refreshUsage(): void {
    this.planLimitsService.refreshUsage();
  }

  upgradePlan(): void {
    // Navegar a la página de planes
    window.location.href = '/plans';
  }
} 