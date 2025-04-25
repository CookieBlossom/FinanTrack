import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '../../shared/shared.modules';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-movements',
  standalone: true,
  imports: [CommonModule, SharedModule, RouterModule],
  templateUrl: './movements.component.html',
  styleUrls: ['./movements.component.css']
})
export class MovementsComponent {}