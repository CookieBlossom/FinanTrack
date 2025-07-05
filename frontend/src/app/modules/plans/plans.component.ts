import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { StripeService } from '../../services/stripe.service';
import { StripePrice, PaymentVerificationResponse } from '../../models/stripe.model';
import { AuthTokenService } from '../../services/auth-token.service';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-plans',
  templateUrl: './plans.component.html',
  styleUrls: ['./plans.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule
  ]
})
export class PlansComponent implements OnInit {
  prices: StripePrice[] = [];
  error = '';
  isAuthenticated = false;

  constructor(
    private stripeService: StripeService,
    private authTokenService: AuthTokenService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    // Primero verificar si estamos retornando de Stripe (antes de verificar autenticación)
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    
    if (sessionId) {
      console.log('🔄 Detectado retorno de Stripe con session_id:', sessionId);
      this.handlePaymentReturn();
      return; // No continuar con el resto si estamos procesando un pago
    }
    
    // Solo verificar autenticación si no estamos procesando un pago
    this.checkAuthentication();
    this.loadPrices();
  }

  checkAuthentication(): void {
    this.isAuthenticated = this.authTokenService.hasToken();
  }

  loadPrices(): void {
    this.stripeService.getPrices().subscribe({
      next: (response) => {
        if (response.success) {
          this.prices = response.prices;
          this.cdr.detectChanges();
        } else {
          this.error = 'Error al cargar los planes';
        }
      },
      error: (error) => {
        console.error('Error cargando precios:', error);
        this.error = 'Error al cargar los planes';
      }
    });
  }

  subscribeToPlan(priceId: string): void {
    // Si no está autenticado, redirigir al login
    if (!this.isAuthenticated) {
      this.router.navigate(['/login'], { 
        queryParams: { 
          returnUrl: '/plans',
          message: 'Debes iniciar sesión para suscribirte a un plan'
        }
      });
      return;
    }
    const getFrontendUrl = (): string => {
      const backendUrl = new URL(environment.apiUrl);
      const hostname = backendUrl.hostname;
      if (hostname.includes('railway.app')) {
        return 'https://finantrack.onrender.com';
      }
      if (hostname.includes('onrender.com')) {
        return 'https://finantrack.onrender.com';
      }
      return 'http://localhost:4200';
    };
    
    const frontendUrl = getFrontendUrl();
    const successUrl = `${frontendUrl}/?stripe_success=true`;
    const cancelUrl = `${frontendUrl}/?stripe_cancel=true`;

    console.log('🔄 Creando sesión de checkout con URLs:', { successUrl, cancelUrl });

    this.stripeService.createCheckoutSession({
      priceId,
      successUrl,
      cancelUrl
    }).subscribe({
      next: (response) => {
        if (response.success) {
          console.log('✅ Sesión de checkout creada, redirigiendo a:', response.checkoutUrl);
          this.stripeService.redirectToCheckout(response.checkoutUrl);
        } else {
          this.error = 'Error al crear la sesión de pago';
        }
      },
      error: (error) => {
        console.error('Error creando sesión de checkout:', error);
        this.error = 'Error al procesar el pago';
      }
    });
  }

  // Método para manejar el retorno de Stripe
  handlePaymentReturn(): void {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    
    if (sessionId) {
      console.log('🔄 Verificando pago para sesión:', sessionId);
      
      // Mostrar estado de carga
      this.error = 'Verificando tu pago...';
      
      // Usar el endpoint público que no requiere autenticación
      this.stripeService.verifyPaymentPublic(sessionId).subscribe({
        next: (response) => {
          if (response.success && response.newToken) {
            console.log('✅ Pago verificado exitosamente');
            console.log('📋 Nuevo plan:', response.payment?.planName);
            // Actualizar token y redirigir
            this.stripeService.updateTokenAndRedirect(response.newToken, '/dashboard');
            // Recargar datos del usuario para reflejar el cambio de plan
            this.reloadUserData();
            alert(`¡Plan actualizado exitosamente! Tu nuevo plan es: ${response.payment?.planName}`);
          } else {
            console.log('⏳ Pago aún no completado, intentando simular webhook...');
            
            // Intentar simular el webhook
            this.stripeService.simulateWebhookBySession(sessionId).subscribe({
              next: (webhookResponse) => {
                if (webhookResponse.success) {
                  console.log('✅ Webhook simulado exitosamente');
                  // Verificar el pago nuevamente
                  setTimeout(() => {
                    this.handlePaymentReturn();
                  }, 1000);
                } else {
                  console.log('❌ Error simulando webhook:', webhookResponse.message);
                  this.error = 'El pago aún no ha sido procesado. Por favor, espera unos minutos y recarga la página.';
                }
              },
              error: (webhookError) => {
                console.error('❌ Error simulando webhook:', webhookError);
                this.error = 'El pago aún no ha sido procesado. Por favor, espera unos minutos y recarga la página.';
              }
            });
          }
        },
        error: (error) => {
          console.error('❌ Error verificando pago:', error);
          this.error = 'Error al verificar el pago. Por favor, contacta soporte.';
        }
      });
    }
  }

  goToLogin(): void {
    this.router.navigate(['/login'], { 
      queryParams: { returnUrl: '/plans' }
    });
  }

  goToRegister(): void {
    this.router.navigate(['/register'], { 
      queryParams: { returnUrl: '/plans' }
    });
  }

  formatPrice(amount: number, currency: string): string {
    if (amount === 0) {
      return 'Gratis';
    }
    
    const formatter = new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 0
    });
    
    return formatter.format(amount);
  }

  getPlanFeatures(planName: string): string[] {
    const features = {
      basic: [
        '100 movimientos manuales por mes',
        'Máximo 2 tarjetas activas',
        '5 palabras clave por categoría',
        '5 movimientos proyectados',
        'Categorización básica',
        'Soporte por email',
        'Sin cartolas bancarias',
        'Sin scraper automático'
      ],
      premium: [
        '1,000 movimientos manuales por mes',
        'Subida de Cartolas bancarias ILIMITADAS',
        'Máximo 10 tarjetas activas',
        '10 palabras clave por categoría',
        '20 movimientos proyectados',
        'Categorización avanzada',
        'Exportar datos',
        'Soporte prioritario',
        'Sin scraper automático'
      ],
      pro: [
        'Movimientos manuales ilimitados',
        'Subida de Cartolas bancarias ilimitadas',
        'Scraper automático de bancos',
        'Tarjetas ilimitadas',
        'Palabras clave ilimitadas por categoría',
        'Movimientos proyectados ilimitados',
        'Categorización automatizada',
        'Soporte prioritario'
      ]
    };

    return features[planName as keyof typeof features] || [];
  }

  getPlanType(price: StripePrice): string {
    // Determinar el tipo de plan basado en el nombre del producto
    const productName = price.product.name?.toLowerCase() || '';
    let planType = 'basic';
    
    if (productName.includes('pro')) {
      planType = 'pro';
    } else if (productName.includes('premium')) {
      planType = 'premium';
    } else if (productName.includes('básico') || productName.includes('basic')) {
      planType = 'basic';
    }
    
    return planType;
  }

  getPlanDescription(planType: string): string {
    const descriptions = {
      basic: 'Plan básico: hasta 100 movimientos manuales, 2 tarjetas, 5 palabras clave por categoría',
      premium: 'Plan premium: hasta 1,000 movimientos manuales, 10 tarjetas, 10 palabras clave, cartolas bancarias ilimitadas',
      pro: 'Plan pro: todo ilimitado, scraper automático, categorización automatizada con IA'
    };

    return descriptions[planType as keyof typeof descriptions] || descriptions.basic;
  }

  // Método para recargar datos del usuario
  reloadUserData(): void {
    // Emitir un evento para que otros componentes sepan que el plan cambió
    window.dispatchEvent(new CustomEvent('planUpdated', {
      detail: { planName: 'premium' }
    }));
  }
}
