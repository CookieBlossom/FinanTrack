import {  Component  } from '@angular/core';

import { MatIcon, MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { RouterModule } from '@angular/router';
@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [ MatIconModule,  MatIcon, MatButtonModule,RouterModule],
  templateUrl: './config.component.html',
  styleUrls: ['./config.component.css'],
})
export class ConfigComponent {}