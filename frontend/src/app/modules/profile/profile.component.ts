import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule, Router } from '@angular/router';
import { MatIcon } from '@angular/material/icon';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { User, UserProfileUpdate } from '../../models/user.model';
import {
  MatDialog,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { ChangePasswordComponent } from './change-password/change-password.component';
import { AuthTokenService } from '../../services/auth-token.service';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
  imports: [
    CommonModule, 
    MatIconModule, 
    MatButtonModule, 
    RouterModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule
  ],
  standalone: true,
})
export class ProfileComponent implements OnInit {
  readonly dialog = inject(MatDialog);
  private userService = inject(UserService);
  private authService = inject(AuthService);
  private snackBar = inject(MatSnackBar);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private authTokenService = inject(AuthTokenService);

  userData: User | null = null;
  profileForm: FormGroup;
  isEditing = false;
  isLoading = true;

  constructor() {
    this.profileForm = this.fb.group({
      firstName: ['', [Validators.required]],
      lastName: [''],
      countryCode: [''],
      phone: ['', [Validators.minLength(9), Validators.maxLength(9)]]
    });
  }

  ngOnInit() {
    this.loadUserData();
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/home']);
    this.snackBar.open('Sesión cerrada exitosamente', 'Cerrar', { duration: 3000 });
  }

  loadUserData() {
    this.isLoading = true;
    const token = this.authTokenService.getToken();
    
    if (!token) {
      this.snackBar.open('No hay sesión activa', 'Cerrar', {
        duration: 3000,
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
      this.router.navigate(['/login']);
      return;
    }

    this.userService.getProfile().subscribe({
      next: (data: any) => {
        console.log('Datos recibidos del backend:', data);
        
        // Mapear los datos del backend al formato del frontend
        const mappedData: User = {
          id: data.id,
          email: data.email,
          firstName: data.first_name,
          lastName: data.last_name || '',
          countryCode: data.country_code || '',
          planId: data.plan_id,
          planName: data.plan_name,
          phone: data.phone || '',
          role: data.role,
          isActive: data.is_active,
          createdAt: new Date(data.created_at),
          updatedAt: new Date(data.updated_at)
        };
        
        console.log('Datos mapeados:', mappedData);
        this.userData = mappedData;
        
        // Actualizar el formulario con los datos mapeados
        this.profileForm.patchValue({
          firstName: mappedData.firstName,
          lastName: mappedData.lastName,
          countryCode: mappedData.countryCode,
          phone: mappedData.phone
        });
        
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error al cargar el perfil:', error);
        this.snackBar.open(
          error.error?.message || 'Error al cargar el perfil',
          'Cerrar',
          { duration: 3000 }
        );
        this.isLoading = false;
      }
    });
  }

  toggleEdit() {
    this.isEditing = !this.isEditing;
    if (!this.isEditing && this.userData) {
      this.profileForm.patchValue({
        firstName: this.userData.firstName,
        lastName: this.userData.lastName,
        countryCode: this.userData.countryCode,
        phone: this.userData.phone
      });
    }
  }

  saveProfile() {
    if (this.profileForm.get('firstName')?.valid) {
      const formData = this.profileForm.value;
      const updateData: UserProfileUpdate = {
        firstName: formData.firstName,
        lastName: formData.lastName || null,
        countryCode: formData.countryCode || null,
        phone: formData.phone || null
      };

      this.userService.updateProfile(updateData).subscribe({
        next: (updatedUser) => {
          console.log('Perfil actualizado:', updatedUser);
          this.userData = updatedUser;
          this.snackBar.open('Perfil actualizado exitosamente', 'Cerrar', { duration: 3000 });
        },
        error: (error) => {
          console.error('Error al actualizar el perfil:', error);
          this.snackBar.open(
            error.error?.message || 'Error al actualizar el perfil',
            'Cerrar',
            { duration: 3000 }
          );
        }
      });
    } else {
      this.profileForm.get('firstName')?.markAsTouched();
    }
  }

  openChangePasswordDialog() {
    // Implementar diálogo de cambio de contraseña
    console.log('Abrir diálogo de cambio de contraseña');
  }

  openBillingSection() {
    // Navegar a la página de planes para gestionar la suscripción
    this.router.navigate(['/plans']);
  }

  // Métodos para el template
  getInitials(): string {
    if (!this.userData?.firstName && !this.userData?.lastName) {
      return 'U';
    }
    
    const firstName = this.userData?.firstName?.charAt(0) || '';
    const lastName = this.userData?.lastName?.charAt(0) || '';
    
    return (firstName + lastName).toUpperCase();
  }

  getPlanName(): string {
    if (!this.userData?.planName) {
      return 'Plan Gratuito';
    }
    
    const planNames: { [key: string]: string } = {
      'free': 'Plan Gratuito',
      'basic': 'Plan Básico',
      'premium': 'Plan Premium',
      'pro': 'Plan Pro'
    };
    
    return planNames[this.userData.planName] || this.userData.planName;
  }

  getPlanPrice(): string {
    const planPrices: { [key: string]: string } = {
      'free': 'Gratis',
      'basic': '$9.990/mes',
      'premium': '$19.990/mes',
      'pro': '$29.990/mes'
    };
    
    return planPrices[this.userData?.planName || 'free'] || 'Gratis';
  }

  isCurrentPlan(planName: string): boolean {
    return this.userData?.planName === planName;
  }

  getMemberSince(): string {
    if (!this.userData?.createdAt) return 'Reciente';
    
    const date = new Date(this.userData.createdAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 30) {
      return `${diffDays} días`;
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `${months} ${months === 1 ? 'mes' : 'meses'}`;
    } else {
      const years = Math.floor(diffDays / 365);
      return `${years} ${years === 1 ? 'año' : 'años'}`;
    }
  }

  openDialog(enterAnimationDuration: string, exitAnimationDuration: string): void {
    const dialogRef = this.dialog.open(DialogAnimation, {
      width: '250px',
      enterAnimationDuration,
      exitAnimationDuration,
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result === 'confirm') {
        this.deleteAccount();
      }
    });
  }

  deleteAccount() {
    if (confirm('¿Estás seguro de que deseas eliminar tu cuenta? Esta acción no se puede deshacer.')) {
      this.userService.deleteAccount().subscribe({
        next: () => {
          this.authService.logout();
          this.router.navigate(['/login']);
          this.snackBar.open('Cuenta eliminada exitosamente', 'Cerrar', { duration: 3000 });
        },
        error: (error) => {
          console.error('Error al eliminar la cuenta:', error);
          this.snackBar.open(
            error.error?.message || 'Error al eliminar la cuenta',
            'Cerrar',
            { duration: 3000 }
          );
        }
      });
    }
  }

  // Método para recargar datos del usuario (útil después de cambiar plan)
  reloadUserData(): void {
    this.loadUserData();
  }

  // Método para verificar si el plan ha cambiado
  checkPlanUpdate(): void {
    // Recargar datos del usuario para obtener el plan actualizado
    this.loadUserData();
  }
}

@Component({
  selector: 'dialog-animation',
  template: `
    <h2 mat-dialog-title>Eliminar cuenta</h2>
    <mat-dialog-content>
      ¿Está seguro de que desea eliminar su cuenta? Esta acción no se puede deshacer.
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancelar</button>
      <button mat-button [mat-dialog-close]="'confirm'" cdkFocusInitial>Eliminar</button>
    </mat-dialog-actions>
  `,
  standalone: true,
  imports: [MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose, MatButtonModule],
})
export class DialogAnimation {
  readonly dialogRef = inject(MatDialogRef<DialogAnimation>);

  confirm() {
    this.dialogRef.close('confirm');
  }
}