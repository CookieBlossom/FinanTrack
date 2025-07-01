import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, OnInit, HostListener } from '@angular/core';
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
export class ToolbarComponent implements OnInit {
  @Output() toggle = new EventEmitter<void>();
  isTopNav = false;

  ngOnInit() {
    this.checkScreenSize();
  }

  @HostListener('window:resize', ['$event'])
  onResize() {
    this.checkScreenSize();
  }

  private checkScreenSize() {
    this.isTopNav = window.innerWidth < 850;
  }

  toggleSidebar() {
    this.toggle.emit();
  }

  toggleTheme() {
    document.documentElement.classList.toggle('dark-theme');
  }
}