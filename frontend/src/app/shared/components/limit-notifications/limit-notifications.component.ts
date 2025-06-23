import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { LimitNotificationsService, LimitNotification } from '../../../services/limit-notifications.service';
import { LimitAlertComponent } from '../limit-alert/limit-alert.component';

@Component({
  selector: 'app-limit-notifications',
  standalone: true,
  imports: [CommonModule, LimitAlertComponent],
  template: `
    <div class="notifications-container">
      <app-limit-alert
        *ngFor="let notification of activeNotifications"
        [limitCheck]="notification.limitCheck"
        [permissionCheck]="notification.permissionCheck"
        [featureName]="notification.featureName"
        (onUpgrade)="upgradePlan()"
        (onClose)="dismissNotification(notification.id)">
      </app-limit-alert>
    </div>
  `,
  styles: [`
    .notifications-container {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-width: 400px;
    }
  `]
})
export class LimitNotificationsComponent implements OnInit, OnDestroy {
  activeNotifications: LimitNotification[] = [];
  private subscriptions: Subscription[] = [];

  constructor(private limitNotificationsService: LimitNotificationsService) {}

  ngOnInit(): void {
    this.subscriptions.push(
      this.limitNotificationsService.getActiveNotifications().subscribe(notifications => {
        this.activeNotifications = notifications;
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  dismissNotification(notificationId: string): void {
    this.limitNotificationsService.dismissNotification(notificationId);
  }

  upgradePlan(): void {
    window.location.href = '/plans';
  }
} 