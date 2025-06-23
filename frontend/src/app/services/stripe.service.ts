import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { CheckoutSessionRequest, CheckoutSessionResponse, StripePrice, PaymentVerificationResponse } from '../models/stripe.model';
import { AuthTokenService } from './auth-token.service';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class StripeService {
  private apiUrl = `${environment.apiUrl}/stripe`;

  constructor(
    private http: HttpClient,
    private authTokenService: AuthTokenService,
    private router: Router
  ) { }

  getPrices(): Observable<{ success: boolean; prices: StripePrice[] }> {
    return this.http.get<{ success: boolean; prices: StripePrice[] }>(`${this.apiUrl}/prices`);
  }

  createCheckoutSession(request: CheckoutSessionRequest): Observable<CheckoutSessionResponse> {
    return this.http.post<CheckoutSessionResponse>(`${this.apiUrl}/create-checkout-session`, request);
  }

  redirectToCheckout(checkoutUrl: string): void {
    window.location.href = checkoutUrl;
  }

  verifyPayment(sessionId: string): Observable<PaymentVerificationResponse> {
    return this.http.get<PaymentVerificationResponse>(`${this.apiUrl}/verify-payment?session_id=${sessionId}`);
  }

  verifyPaymentPublic(sessionId: string): Observable<PaymentVerificationResponse> {
    return this.http.get<PaymentVerificationResponse>(`${this.apiUrl}/stripe/verify-payment-public?session_id=${sessionId}`);
  }

  simulateWebhookBySession(sessionId: string): Observable<PaymentVerificationResponse> {
    return this.http.post<PaymentVerificationResponse>(`${this.apiUrl}/stripe/simulate-webhook-by-session`, { session_id: sessionId });
  }

  handlePaymentSuccess(sessionId: string): Observable<PaymentVerificationResponse> {
    return this.verifyPayment(sessionId);
  }

  updateTokenAndRedirect(newToken: string, redirectUrl: string = '/dashboard'): void {
    // Actualizar el token en el servicio de autenticación
    this.authTokenService.setToken(newToken);
    
    // Redirigir al usuario
    this.router.navigate([redirectUrl]);
  }
} 