import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../services/auth.service';
import { AuthResponse } from '../../models/user.model';
import { TermsConditionsDialogComponent } from './terms-conditions-dialog/terms-conditions-dialog.component';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    // Se usa dinámicamente en openTermsDialog()
    TermsConditionsDialogComponent
  ],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent {
  registerForm: FormGroup;
  hidePassword = true;
  hideConfirmPassword = true;
  isLoading = false;
  isCheckingEmail = false;
  emailExists = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {
    this.registerForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: [''],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
      acceptTerms: [false, [Validators.requiredTrue]]
    }, {
      validators: this.passwordMatchValidator
    });

    // Verificar email en tiempo real
    this.registerForm.get('email')?.valueChanges.pipe(
      debounceTime(500),
      distinctUntilChanged(),
      switchMap(email => {
        if (email && this.registerForm.get('email')?.valid) {
          this.isCheckingEmail = true;
          return this.authService.checkEmailExists(email);
        } else {
          this.emailExists = false;
          return of(null);
        }
      })
    ).subscribe({
      next: (response) => {
        this.isCheckingEmail = false;
        if (response) {
          this.emailExists = response.exists;
          if (response.exists) {
            this.registerForm.get('email')?.setErrors({ emailExists: true });
          } else {
            const currentErrors = this.registerForm.get('email')?.errors;
            if (currentErrors) {
              delete currentErrors['emailExists'];
              const newErrors = Object.keys(currentErrors).length > 0 ? currentErrors : null;
              this.registerForm.get('email')?.setErrors(newErrors);
            }
          }
        }
      },
      error: (error) => {
        this.isCheckingEmail = false;
        console.error('Error al verificar email:', error);
      }
    });
  }

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password');
    const confirmPassword = form.get('confirmPassword');

    if (password && confirmPassword && password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    return null;
  }

  openTermsDialog(): void {
    const dialogRef = this.dialog.open(TermsConditionsDialogComponent, {
      width: '90vw',
      maxWidth: '800px',
      maxHeight: '80vh',
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result === true) {
        this.registerForm.get('acceptTerms')?.setValue(true);
        this.snackBar.open('Términos y condiciones aceptados', 'Cerrar', {
          duration: 2000,
          horizontalPosition: 'center',
          verticalPosition: 'top'
        });
      } else {
        this.registerForm.get('acceptTerms')?.setValue(false);
      }
    });
  }

  onSubmit() {
    if (this.registerForm.invalid) {
      Object.keys(this.registerForm.controls).forEach(key => {
        const control = this.registerForm.get(key);
        if (control?.invalid) {
          control.markAsTouched();
        }
      });
      return;
    }

    // Verificar si el email existe antes de intentar registrar
    if (this.emailExists) {
      this.snackBar.open('El email ya está registrado en el sistema. Por favor, use otro email o inicie sesión.', 'Cerrar', {
        duration: 5000,
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
      return;
    }

    this.isLoading = true;
    this.registerForm.disable();

    const userData = {
      firstName: this.registerForm.get('firstName')?.value,
      lastName: this.registerForm.get('lastName')?.value,
      email: this.registerForm.get('email')?.value,
      password: this.registerForm.get('password')?.value
    };

    console.log('Intentando registrar usuario:', userData);

    this.authService.register(userData).subscribe({
      next: (response: AuthResponse) => {
        console.log('Respuesta del servidor:', response);
        if (response.success) {
          this.snackBar.open('Registro exitoso', 'Cerrar', {
            duration: 3000,
            horizontalPosition: 'center',
            verticalPosition: 'top'
          });
          this.router.navigate(['/login']);
        } else {
          this.snackBar.open(response.message || 'Error en el registro', 'Cerrar', {
            duration: 3000,
            horizontalPosition: 'center',
            verticalPosition: 'top'
          });
        }
      },
      error: (error) => {
        console.error('Error en el registro:', error);
        
        let errorMessage = 'Error al registrar usuario. Por favor, intente nuevamente.';
        let duration = 5000;
        
        // Manejar errores específicos
        if (error.status === 409 || error.errorCode === 'EMAIL_EXISTS') {
          errorMessage = 'El email ya está registrado en el sistema. Por favor, use otro email o inicie sesión.';
          duration = 7000;
          // Marcar el campo email como inválido
          this.registerForm.get('email')?.setErrors({ emailExists: true });
          this.emailExists = true;
        } else if (error.status === 400 || error.errorCode === 'VALIDATION_ERROR') {
          errorMessage = error.message || 'Datos de entrada inválidos. Por favor, revise la información ingresada.';
        } else if (error.status === 422) {
          errorMessage = 'Datos de validación incorrectos. Por favor, revise la información ingresada.';
        } else if (error.status === 500 || error.errorCode === 'INTERNAL_ERROR') {
          errorMessage = 'Error interno del servidor. Por favor, intente más tarde.';
        } else if (error.status === 0) {
          errorMessage = 'No se puede conectar con el servidor. Verifique su conexión a internet.';
        } else {
          // Usar el mensaje del error si está disponible y es amigable
          const message = error.message || error.error?.message;
          if (message && !message.includes('llave duplicada') && !message.includes('viola restricción')) {
            errorMessage = message;
          } else {
            errorMessage = 'Error al registrar usuario. Por favor, intente nuevamente.';
          }
        }
        
        this.snackBar.open(errorMessage, 'Cerrar', {
          duration: duration,
          horizontalPosition: 'center',
          verticalPosition: 'top'
        });
      },
      complete: () => {
        this.isLoading = false;
        this.registerForm.enable();
      }
    });
  }
}
