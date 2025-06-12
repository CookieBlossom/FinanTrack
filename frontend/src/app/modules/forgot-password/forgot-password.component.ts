import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { UserService } from '../../services/user.service';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatIconModule
  ],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.css'
})
export class ForgotPasswordComponent {
  forgotPasswordForm: FormGroup;
  loading = false;
  emailSent = false;

  constructor(
    private fb: FormBuilder,
    private userService: UserService,
    private snackBar: MatSnackBar,
    private router: Router
  ) {
    this.forgotPasswordForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }
  ngOnInit() {
    const token = new URLSearchParams(window.location.search).get('token');
    if (token) {
      this.router.navigate(['/reset-password'], { queryParams: { token } });
    }
  }

  requestPasswordReset(): void {
    if (this.forgotPasswordForm.invalid) return;
  
    this.loading = true;
  
    const email = this.forgotPasswordForm.value.email;
    this.userService.forgotPassword(email).subscribe({
      next: () => {
        this.emailSent = true;
        this.snackBar.open('Se enviaron las instrucciones a tu correo', 'Cerrar', { duration: 3000 });
        setTimeout(() => {
          this.router.navigate(['']);
        }, 3000);
      },
      error: (err) => {
        this.snackBar.open(err.error?.message || 'Error al enviar el correo', 'Cerrar', { duration: 3000 });
        this.loading = false;
      }
    });
  }
}