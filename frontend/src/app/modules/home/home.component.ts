import { Component, OnInit } from '@angular/core';
import { RouterLink, Router } from '@angular/router';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  standalone: true,
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit {

  constructor(private router: Router) {}

  ngOnInit(): void {
    // Verificar si venimos de Stripe
    const urlParams = new URLSearchParams(window.location.search);
    const stripeSuccess = urlParams.get('stripe_success');
    const stripeCancel = urlParams.get('stripe_cancel');
    const sessionId = urlParams.get('session_id');

    if (stripeSuccess && sessionId) {
      // Redirigir a plans con el session_id
      this.router.navigate(['/plans'], { 
        queryParams: { session_id: sessionId }
      });
    } else if (stripeCancel) {
      // Redirigir a plans sin session_id (cancelado)
      this.router.navigate(['/plans']);
    }
  }
}
