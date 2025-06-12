import { Component } from '@angular/core';
import { FormGroup, FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { UserService } from '../../services/user.service';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterModule } from '@angular/router';
@Component({
  selector: 'app-reset-password',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule, // <-- esto es clave
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.css',

})
export class ResetPasswordComponent {
  resetPasswordForm: FormGroup;
  loading = false;
  token: string | null = null;

  constructor(
    private fb: FormBuilder,
    private userService: UserService,
    private snackBar: MatSnackBar,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.resetPasswordForm = this.fb.group({
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    }, {
      validators: [
        this.passwordsMatchValidator,
        this.preventSamePasswordValidator
      ]
    });
    this.route.queryParams.subscribe(params => {
      this.token = params['token'] || null;
    });
  }

  passwordsMatchValidator = (form: FormGroup) => {
    const newPassword = form.get('newPassword')?.value;
    const confirmPassword = form.get('confirmPassword')?.value;
  
    return newPassword === confirmPassword ? null : { mismatch: true };
  };
  
  preventSamePasswordValidator = (form: FormGroup) => {
    const newPassword = form.get('newPassword')?.value;
    const confirmPassword = form.get('confirmPassword')?.value;
  
    return newPassword && confirmPassword && newPassword === confirmPassword
      ? { sameAsPrevious: true }
      : null;
  };
  reset(): void {
    if (!this.token || this.resetPasswordForm.invalid) return;
    this.loading = true;
    this.userService.resetPassword(this.token, this.resetPasswordForm.value.newPassword).subscribe({
      next: () => {
        this.snackBar.open('Contraseña actualizada', 'Cerrar', { duration: 3000 });
        this.router.navigate(['/login']);
      },
      error: () => {
        this.snackBar.open('Error al actualizar contraseña', 'Cerrar', { duration: 3000 });
        this.loading = false;
      }
    });
  }
}