import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-upcoming-transactions',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './upcoming-transactions.component.html',
  styleUrls: ['./upcoming-transactions.component.scss']
})
export class UpcomingTransactionsComponent {}