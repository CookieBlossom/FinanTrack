import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom, Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';

import { CardService } from '../../../services/card.service';
import { AuthTokenService } from '../../../services/auth-token.service';
import { RutUtils } from '../../../utils/rut.utils';
import { InstantErrorStateMatcher } from '../../../utils/error-state.matcher';
import { Bank, CardType } from '../../../models/card.model';

interface CardCredentials {
  rut: string;
  password: string;
  site?: string;
}

@Component({
  selector: 'app-add-card-dialog',
  templateUrl: './add-card-dialog.component.html',
  styleUrls: ['./add-card-dialog.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatIconModule,
    MatTooltipModule,
    MatTabsModule
  ]
})
export class AddCardDialogComponent implements OnInit, OnDestroy {
  cardForm: FormGroup;
  manualForm: FormGroup;
  manualError: string | null = null;
  cardTypes: CardType[] = [];
  banks: Bank[] = [];
  loading = false;
  isUploading = false;
  error: string | null = null;
  progress = 0;
  statusMessage = '';
  canRetry = false;
  private destroy$ = new Subject<void>();
  matcher = new InstantErrorStateMatcher();

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<AddCardDialogComponent>,
    private cardService: CardService,
    private authTokenService: AuthTokenService,
    private snackBar: MatSnackBar
  ) {
    // Scraper form
    this.cardForm = this.fb.group({
      rut: ['', [
        Validators.required,
        (control: AbstractControl) => {
          const value = control.value;
          return RutUtils.validate(value) ? null : { invalidRut: true };
        }
      ]],
      password: ['', [
        Validators.required,
        Validators.minLength(4)
      ]],
      bank: ['', Validators.required]
    });

    // Manual form
    this.manualForm = this.fb.group({
      nameAccount: ['', Validators.required],
      aliasAccount: [''],
      cardTypeId: [null, Validators.required],
      bankId: [null],
      balance: [0, [Validators.required, Validators.min(0)]],
      currency: ['CLP']
    });
  }

  async ngOnInit() {
    if (!this.authTokenService.hasToken()) {
      const errorMsg = 'No hay sesión activa. Por favor, inicia sesión nuevamente.';
      this.error = errorMsg;
      this.snackBar.open(errorMsg, 'Cerrar', { duration: 5000 });
      this.cardForm.disable();
      this.manualForm.disable();
      return;
    }
    // Carga dinámica de tipos y bancos
    this.cardTypes = (await firstValueFrom(this.cardService.getCardTypes()))
    .filter(type => type.name.toLowerCase() !== 'efectivo');

    this.banks = await firstValueFrom(this.cardService.getBanks());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // --- Scraper TAB
  onRutInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    input.value = RutUtils.format(input.value);
  }
  getErrorMessage(field: string): string {
    const control = this.cardForm.get(field);
    if (!control) return '';
    if (control.hasError('required')) return `El ${field} es requerido`;
    if (field === 'rut' && control.hasError('invalidRut')) return 'RUT inválido';
    if (field === 'password' && control.hasError('minlength')) return 'La contraseña debe tener al menos 4 caracteres';
    return '';
  }
  onSubmitScraper(): void {
    if (this.cardForm.invalid) {
      Object.keys(this.cardForm.controls).forEach(key => this.cardForm.get(key)?.markAsTouched());
      return;
    }
    if (!this.authTokenService.hasToken()) {
      const errorMsg = 'No hay sesión activa. Por favor, inicia sesión nuevamente.';
      this.error = errorMsg;
      this.snackBar.open(errorMsg, 'Cerrar', { duration: 5000 });
      return;
    }
    this.loading = true;
    this.progress = 0;
    this.statusMessage = '';
    this.error = null;
    this.canRetry = false;

    const formValue = this.cardForm.value;
    const credentials = {
      rut: RutUtils.clean(formValue.rut),
      password: formValue.password,
      site: formValue.bank
    };
    this.cardService.addCardFromScraper(credentials).pipe(
      takeUntil(this.destroy$),
      finalize(() => {
        if (this.error) this.loading = false;
      })
    ).subscribe({
      next: (response) => {
        if (response.progress !== undefined) this.progress = response.progress;
        if (response.status) this.statusMessage = this.getStatusMessage(response.status);
        if (response.error) {
          this.error = response.error;
          this.canRetry = true;
        }
        if (response.card) {
          this.snackBar.open('¡Tarjeta agregada exitosamente!', 'Cerrar', { duration: 3000 });
          this.dialogRef.close(true);
        }
      },
      error: (err) => {
        const errorMessage = this.getErrorMessageFromError(err) || 'Ocurrió un error al sincronizar la tarjeta.';
        this.error = errorMessage;
        this.canRetry = true;
        this.loading = false;
        this.snackBar.open(errorMessage, 'Cerrar', { duration: 7000 });
      }
    });
  }

  // --- Manual TAB
  onManualSubmit(): void {
    if (this.manualForm.invalid) return;
  
    this.manualError = null; // limpiar error previo
    this.isUploading = true;
  
    this.cardService.addCardManual({
      ...this.manualForm.value,
      source: 'manual'
    }).subscribe({
      next: () => {
        this.snackBar.open('Tarjeta creada con éxito', 'Cerrar', { duration: 3000 });
        this.dialogRef.close(true);
      },
      error: err => {
        this.isUploading = false;
        const errorMsg = err.message || 'Error al crear tarjeta';
        this.manualError = errorMsg;
        this.snackBar.open(errorMsg, 'Cerrar', { duration: 5000 });
      }
    });
  }
  onCancel(): void {
    this.dialogRef.close();
  }
  retrySync(): void {
    this.error = null;
    this.canRetry = false;
    this.onSubmitScraper();
  }
  getStatusMessage(status: string): string {
    const messages: { [key: string]: string } = {
      'initializing': 'Iniciando sincronización...',
      'logging_in': 'Iniciando sesión en el banco...',
      'fetching_data': 'Obteniendo información de la cuenta...',
      'processing': 'Procesando información...',
      'completed': 'Sincronización completada',
      'error': 'Error en la sincronización'
    };
    return messages[status] || status;
  }
  getErrorMessageFromError(error: any): string {
    if (typeof error === 'string') return error;
    if (error.error?.message) return error.error.message;
    if (error.message) return error.message;
    return 'Error desconocido';
  }
} 