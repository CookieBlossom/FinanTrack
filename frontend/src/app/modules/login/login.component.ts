import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, HttpClientModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  loginForm!: FormGroup;
  loginError: string | null = null;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });
  }

  onSubmit(): void {
    this.loginError = null;
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const credentials = this.loginForm.value;
    const loginUrl = 'http://localhost:3000/users/login';

    this.http.post<any>(loginUrl, credentials).subscribe({
      next: (response) => {
        if (response && response.token) {
          localStorage.setItem('authToken', response.token);
          this.router.navigate(['/dashboard']);
        } else {
          this.loginError = 'Respuesta inesperada del servidor.';
          console.error('Error de login: Token no encontrado en la respuesta', response);
        }
      },
      error: (err) => {
        console.error('Error de login:', err);
        if (err.status === 401) {
          this.loginError = 'Email o contraseña incorrectos.';
        } else if (err.error && err.error.message) {
          this.loginError = err.error.message;
        } else {
          this.loginError = 'Error al intentar iniciar sesión. Por favor, inténtalo de nuevo más tarde.';
        }
      }
    });
  }
}

