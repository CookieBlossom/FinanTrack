
import { MatIcon, MatIconModule } from '@angular/material/icon';
import { Component } from '@angular/core';
import {MatInputModule} from '@angular/material/input';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatSelectModule} from '@angular/material/select';



@Component({
  selector: 'app-reset-pasword',
  standalone: true,
  imports: [MatIcon, MatIconModule, MatInputModule, MatFormFieldModule,MatSelectModule],
  templateUrl: './help.component.html',
  styleUrls: ['./help.component.scss']
})
export class HelpComponent{}