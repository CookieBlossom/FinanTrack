import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '../../shared/shared.modules';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-subscriptions',
  standalone: true,
  imports: [CommonModule, SharedModule, RouterModule],
  templateUrl: './subscriptions.component.html',
  styleUrls: ['./subscriptions.component.scss']
})
export class SubscriptionsComponent {}