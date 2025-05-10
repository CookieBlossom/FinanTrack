import { Component } from '@angular/core';
import { MatIcon, MatIconModule } from '@angular/material/icon';
@Component({
  selector: 'app-send-mail',
  standalone: true,
  imports: [  MatIcon, MatIconModule ],
  templateUrl: './send-mail.component.html',
  styleUrl: './send-mail.component.css'
})
export class SendMailComponent {

}
