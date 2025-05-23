import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent implements OnInit {
  registerForm!: FormGroup;
  registerError: string | null = null;
  isLoading: boolean = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.registerForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      passwordConfirm: ['', Validators.required]
    }, {
      validators: this.passwordMatchValidator
    });

    // Log para verificar la inicialización del formulario
    console.log('Formulario inicializado:', this.registerForm.value);
  }

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password');
    const passwordConfirm = form.get('passwordConfirm');
    
    if (password && passwordConfirm && password.value !== passwordConfirm.value) {
      passwordConfirm.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    
    return null;
  }

  onSubmit(): void {
    this.registerError = null;
    if (this.registerForm.invalid) {
      console.log('Formulario inválido:', this.registerForm.errors);
      this.registerForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    const { passwordConfirm, ...userData } = this.registerForm.value;
    
    console.log('Enviando datos de registro:', userData);

    this.authService.register(userData).subscribe({
      next: (response) => {
        console.log('Registro exitoso:', response);
        if (response.success) {
          this.router.navigate(['/login'], { 
            queryParams: { 
              registered: 'true',
              email: userData.email 
            }
          });
        } else {
          this.registerError = response.message || 'Error desconocido en el registro';
        }
      },
      error: (error) => {
        console.error('Error en el registro:', error);
        if (error.status === 0) {
          this.registerError = 'No se pudo conectar con el servidor. Por favor, verifica tu conexión.';
        } else if (error.status === 400) {
          this.registerError = error.error?.message || 'Datos de registro inválidos';
        } else if (error.status === 409) {
          this.registerError = 'El correo electrónico ya está registrado';
        } else {
          this.registerError = 'Error al intentar registrarse. Por favor, inténtelo de nuevo más tarde.';
        }
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  }
}
