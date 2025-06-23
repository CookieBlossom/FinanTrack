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

    console.log('🏠 Home component - Parámetros recibidos:', {
      stripeSuccess,
      stripeCancel,
      sessionId,
      fullUrl: window.location.href
    });

    if (stripeSuccess && sessionId) {
      console.log('🔄 Redirigiendo a plans con session_id:', sessionId);
      // Redirigir a plans con el session_id
      this.router.navigate(['/plans'], { 
        queryParams: { session_id: sessionId }
      });
    } else if (stripeCancel) {
      console.log('🔄 Redirigiendo a plans (cancelado)');
      // Redirigir a plans sin session_id (cancelado)
      this.router.navigate(['/plans']);
    }
  }
}
