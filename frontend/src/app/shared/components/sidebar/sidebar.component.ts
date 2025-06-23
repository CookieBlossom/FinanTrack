import { Component } from '@angular/core';
import { MatNavList } from '@angular/material/list';
import { MatIcon } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FeatureControlDirective } from '../../directives/feature-control.directive';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    MatNavList,
    CommonModule,
    RouterModule,
    MatIcon,
    FeatureControlDirective
  ],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css'
})
export class SidebarComponent {

}
