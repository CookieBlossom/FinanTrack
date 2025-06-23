import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterLink, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { AuthResponse } from '../../models/user.model';
import { StripeService } from '../../services/stripe.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    RouterLink
  ]
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  hidePassword = true;
  isLoading = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private snackBar: MatSnackBar,
    private stripeService: StripeService
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  ngOnInit(): void {
    // Verificar si hay un session_id en la URL (retorno de Stripe)
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    
    if (sessionId) {
      console.log('🔄 Detectado session_id en login:', sessionId);
      // Mostrar mensaje informativo
      this.snackBar.open('Completa el login para verificar tu pago', 'Cerrar', {
        duration: 5000,
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
    }
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      Object.keys(this.loginForm.controls).forEach(key => {
        const control = this.loginForm.get(key);
        if (control?.invalid) {
          control.markAsTouched();
        }
      });
      return;
    }

    this.isLoading = true;
    this.loginForm.disable();

    const credentials = {
      email: this.loginForm.get('email')?.value,
      password: this.loginForm.get('password')?.value
    };

    this.authService.login(credentials).subscribe({
      next: (response: AuthResponse) => {
        console.log('Respuesta completa:', response);
        if (response.token) {
          this.snackBar.open('Inicio de sesión exitoso', 'Cerrar', {
            duration: 3000,
            horizontalPosition: 'center',
            verticalPosition: 'top'
          });
          
          // Verificar si hay un session_id para procesar el pago
          const urlParams = new URLSearchParams(window.location.search);
          const sessionId = urlParams.get('session_id');
          
          if (sessionId) {
            console.log('🔄 Procesando pago después del login para sesión:', sessionId);
            this.processPaymentAfterLogin(sessionId);
          } else {
            // Navegación normal después del login
            this.router.navigate(['/dashboard']);
          }
        } else {
          this.snackBar.open('Error en el inicio de sesión', 'Cerrar', {
            duration: 3000,
            horizontalPosition: 'center',
            verticalPosition: 'top'
          });
          this.isLoading = false;
          this.loginForm.enable();
        }
      },
      error: (error) => {
        console.error('Error en login:', error);
        this.snackBar.open(error.message || 'Error en el inicio de sesión', 'Cerrar', {
          duration: 3000,
          horizontalPosition: 'center',
          verticalPosition: 'top'
        });
        this.isLoading = false;
        this.loginForm.enable();
      }
    });
  }

  private processPaymentAfterLogin(sessionId: string): void {
    this.stripeService.verifyPaymentPublic(sessionId).subscribe({
      next: (response) => {
        if (response.success && response.newToken) {
          console.log('✅ Pago verificado exitosamente después del login');
          console.log('📋 Nuevo plan:', response.payment?.planName);
          
          // Actualizar token y redirigir
          this.stripeService.updateTokenAndRedirect(response.newToken, '/dashboard');
          
          // Mostrar mensaje de éxito
          this.snackBar.open(`¡Plan actualizado exitosamente! Tu nuevo plan es: ${response.payment?.planName}`, 'Cerrar', {
            duration: 5000,
            horizontalPosition: 'center',
            verticalPosition: 'top'
          });
        } else {
          console.log('⏳ Pago aún no completado después del login');
          this.snackBar.open('El pago aún no ha sido procesado. Por favor, espera unos minutos.', 'Cerrar', {
            duration: 5000,
            horizontalPosition: 'center',
            verticalPosition: 'top'
          });
          this.router.navigate(['/dashboard']);
        }
      },
      error: (error) => {
        console.error('❌ Error verificando pago después del login:', error);
        this.snackBar.open('Error al verificar el pago. Por favor, contacta soporte.', 'Cerrar', {
          duration: 5000,
          horizontalPosition: 'center',
          verticalPosition: 'top'
        });
        this.router.navigate(['/dashboard']);
      }
    });
  }
}

