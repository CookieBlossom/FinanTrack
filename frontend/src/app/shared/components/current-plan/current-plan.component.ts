import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Subscription } from 'rxjs';
import { FeatureControlService } from '../../../services/feature-control.service';
import { PlanService } from '../../../services/plan.service';
import { UserPlan } from '../../../models/plan.model';

@Component({
  selector: 'app-current-plan',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './current-plan.component.html',
  styleUrls: ['./current-plan.component.css']
})
export class CurrentPlanComponent implements OnInit, OnDestroy {
  @Input() isActive: boolean = true;
  currentPlan: UserPlan | null = null;
  private subscription?: Subscription;

  constructor(
    private featureControlService: FeatureControlService, 
    private planService: PlanService
  ) {}

  ngOnInit(): void {
    this.loadCurrentPlan();
    this.subscription = this.featureControlService.featureControl$.subscribe(control => {
      if (control && !this.currentPlan) {
        // Si no tenemos el plan completo, usamos la información básica
        this.currentPlan = {
          planId: 0,
          planName: control.planName,
          limits: {},
          permissions: []
        };
      }
    });
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  private loadCurrentPlan() {
    this.planService.getCurrentPlan().subscribe({
      next: (plan) => {
        this.currentPlan = plan;
      },
      error: (error) => {
        console.error('Error loading current plan:', error);
      }
    });
  }

  getPlanDisplayName(planName: string): string {
    return this.planService.getPlanDisplayName(planName);
  }
} 