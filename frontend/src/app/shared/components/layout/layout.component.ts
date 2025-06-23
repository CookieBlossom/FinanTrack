import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatSidenavModule } from '@angular/material/sidenav';
import { RouterModule } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { ToolbarComponent } from '../toolbar/toolbar.component';
import { MatToolbarModule } from '@angular/material/toolbar';
import { HostListener } from '@angular/core';
import { LimitNotificationsComponent } from '../limit-notifications/limit-notifications.component';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatSidenavModule,
    MatToolbarModule,
    SidebarComponent,
    ToolbarComponent,
    LimitNotificationsComponent
  ],
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.css']
})
export class LayoutComponent {
  isSidebarOpen = true;
  isMobile = false;

  constructor() {
    this.checkIfMobile();
  }

  @HostListener('window:resize', [])
  onResize() {
    this.checkIfMobile();
  }

  checkIfMobile() {
    this.isMobile = window.innerWidth <= 1150;
  }
  toggleSidebar() {
    if (this.isMobile) {
      // En mobile simplemente mostramos/ocultamos
      this.isSidebarOpen = !this.isSidebarOpen;
    } else {
      // En desktop, seguimos cambiando el grid
      this.isSidebarOpen = !this.isSidebarOpen;
    }
  }
}