import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialogRef } from '@angular/material/dialog';
import { UserService } from '../../../services/user.service';
import { UserPasswordChange } from '../../../models/user.model';

@Component({
  selector: 'app-change-password',
  templateUrl: './change-password.component.html',
  styleUrl: './change-password.component.css',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule
  ]
})
export class ChangePasswordComponent {
  private fb = inject(FormBuilder);
  private userService = inject(UserService);
  private snackBar = inject(MatSnackBar);
  private dialogRef = inject(MatDialogRef<ChangePasswordComponent>);

  changePasswordForm: FormGroup;
  isLoading = false;

  constructor() {
    this.changePasswordForm = this.fb.group({
      currentPassword: ['', [Validators.required, Validators.minLength(6)]],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    }, {
      validators: this.passwordMatchValidator
    });
  }

  private passwordMatchValidator(form: FormGroup) {
    const newPassword = form.get('newPassword')?.value;
    const confirmPassword = form.get('confirmPassword')?.value;

    if (newPassword && confirmPassword && newPassword !== confirmPassword) {
      form.get('confirmPassword')?.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    return null;
  }

  onSubmit() {
    if (this.changePasswordForm.valid) {
      this.isLoading = true;
      const passwordData: UserPasswordChange = {
        currentPassword: this.changePasswordForm.get('currentPassword')?.value,
        newPassword: this.changePasswordForm.get('newPassword')?.value,
        confirmPassword: this.changePasswordForm.get('confirmPassword')?.value
      };

      console.log('Enviando solicitud de cambio de contraseña:', passwordData);

      this.userService.updatePassword(passwordData).subscribe({
        next: (response) => {
          console.log('Respuesta del servidor:', response);
          this.snackBar.open('Contraseña actualizada exitosamente', 'Cerrar', { duration: 3000 });
          this.dialogRef.close('success');
        },
        error: (error) => {
          console.error('Error al cambiar la contraseña:', error);
          let errorMessage = 'Error al cambiar la contraseña';
          
          if (error.error?.message) {
            errorMessage = error.error.message;
          } else if (error.status === 404) {
            errorMessage = 'El servicio de cambio de contraseña no está disponible';
          } else if (error.status === 401) {
            errorMessage = 'La contraseña actual es incorrecta';
          }
          
          this.snackBar.open(errorMessage, 'Cerrar', { duration: 3000 });
        },
        complete: () => {
          this.isLoading = false;
        }
      });
    } else {
      Object.keys(this.changePasswordForm.controls).forEach(key => {
        const control = this.changePasswordForm.get(key);
        if (control?.invalid) {
          control.markAsTouched();
        }
      });
    }
  }

  onCancel() {
    this.dialogRef.close();
  }
} 