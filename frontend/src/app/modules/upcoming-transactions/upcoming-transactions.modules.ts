import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '../../shared/shared.modules';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-upcoming-transactions',
  standalone: true,
  imports: [CommonModule, SharedModule, RouterModule],
  templateUrl: './upcoming-transactions.component.html',
  styleUrls: ['./upcoming-transactions.component.scss']
})
export class UpcomingTransactionsComponent {}