import { Component } from '@angular/core';
import { MatListItem } from '@angular/material/list';
import { MatNavList } from '@angular/material/list';
import { MatIcon } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common'; 
@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    MatListItem,
    MatNavList,
    CommonModule,
    RouterModule,
    MatIcon
  ],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css'
})
export class SidebarComponent {

}
