import { Component, OnInit, HostListener } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { MatIconButton } from '@angular/material/button';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatIcon,
    MatTooltip,
    MatIconButton
  ],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css'
})
export class SidebarComponent implements OnInit {
  isMobile = false;
  isCollapsed = false;
  isTopNav = false;

  ngOnInit() {
    this.checkScreenSize();
  }

  @HostListener('window:resize', ['$event'])
  onResize() {
    this.checkScreenSize();
  }

  private checkScreenSize() {
    this.isMobile = window.innerWidth < 850;
    this.isTopNav = window.innerWidth < 850;
    this.isCollapsed = false;
  }

  toggleSidebar() {
    if (this.isMobile && !this.isTopNav) {
      this.isCollapsed = !this.isCollapsed;
    }
  }
}
