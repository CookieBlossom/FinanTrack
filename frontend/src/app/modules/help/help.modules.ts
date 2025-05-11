
import { MatIcon, MatIconModule } from '@angular/material/icon';
import { Component } from '@angular/core';
import {MatInputModule} from '@angular/material/input';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatSelectModule} from '@angular/material/select';
import { CommonModule } from '@angular/common';


@Component({
  selector: 'app-reset-pasword',
  standalone: true,
  imports: [MatIcon, MatIconModule, MatInputModule, MatFormFieldModule,MatSelectModule, CommonModule],
  templateUrl: './help.component.html',
  styleUrls: ['./help.component.scss']
})
export class HelpComponent{}