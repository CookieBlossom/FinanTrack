import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { CurrentPlanComponent } from '../current-plan/current-plan.component';

@Component({
  selector: 'app-toolbar',
  standalone: true,
  imports: [MatIcon, CommonModule, RouterModule, CurrentPlanComponent],
  templateUrl: './toolbar.component.html',
  styleUrl: './toolbar.component.css'
})
export class ToolbarComponent {
  @Output() toggle = new EventEmitter<void>();

  toggleSidebar() {
    this.toggle.emit();
  }
  toggleTheme() {
    document.documentElement.classList.toggle('dark-theme');
  }
}