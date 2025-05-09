import { MatIcon, MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { Component } from '@angular/core';



@Component({
  selector: 'app-reset-pasword',
  standalone: true,
  imports: [MatIcon, MatIconModule, MatButtonModule],
  templateUrl: './new-password.component.html',
  styleUrls: ['./new-password.component.scss']
})
export class NewPasswordComponent{}