import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { FeatureControlService } from '../../../services/feature-control.service';

@Component({
  selector: 'app-current-plan',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="current-plan-container" *ngIf="planInfo">
      <div class="plan-badge">
        <span class="plan-name">{{ planInfo.planDisplayName }}</span>
        <button 
          class="upgrade-btn" 
          (click)="upgradePlan()"
          *ngIf="planInfo.planName === 'free'">
          Actualizar
        </button>
      </div>
    </div>
  `,
  styles: [`
    .current-plan-container {
      display: flex;
      align-items: center;
    }

    .plan-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #f8f9fa;
      border: 1px solid #e9ecef;
      border-radius: 20px;
      padding: 4px 12px;
      font-size: 12px;
    }

    .plan-name {
      color: #495057;
      font-weight: 500;
    }

    .upgrade-btn {
      background: #8B2635;
      color: white;
      border: none;
      border-radius: 12px;
      padding: 2px 8px;
      font-size: 10px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
    }

    .upgrade-btn:hover {
      background: #6B1E2A;
    }
  `]
})
export class CurrentPlanComponent implements OnInit, OnDestroy {
  planInfo: { planName: string; planDisplayName: string } | null = null;
  private subscription?: Subscription;

  constructor(private featureControlService: FeatureControlService) {}

  ngOnInit(): void {
    this.subscription = this.featureControlService.featureControl$.subscribe(control => {
      if (control) {
        this.planInfo = {
          planName: control.planName,
          planDisplayName: control.planDisplayName
        };
      }
    });
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  upgradePlan(): void {
    window.location.href = '/plans';
  }
} 