import {  Component  } from '@angular/core';

import { MatIcon, MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [ MatIconModule,  MatIcon],
  templateUrl: './config.component.html',
  styleUrls: ['./config.component.css'],
})
export class ConfigComponent {}