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
import { PlanLimitsService } from '../../../services/plan-limits.service';
import { LimitNotificationComponent, LimitNotificationData } from '../../../shared/components/limit-notification/limit-notification.component';
import { PLAN_LIMITS } from '../../../models/plan.model';
import { FeatureControlService } from '../../../services/feature-control.service';

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
    MatTabsModule,
    LimitNotificationComponent
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
  activeTab = 'automatic'; // Tab activo por defecto
  hidePassword = true; // Para mostrar/ocultar contraseña
  private destroy$ = new Subject<void>();
  matcher = new InstantErrorStateMatcher();

  // Variables para límites
  limitsInfo: any = null;
  showLimitNotification = false;
  limitNotificationData: LimitNotificationData = {
    type: 'warning',
    title: '',
    message: '',
    limit: 0,
    current: 0,
    showUpgradeButton: false
  };

  // Variables para control de plan
  currentPlanName: string = 'free';
  showAutomaticTab: boolean = false;
  showManualTab: boolean = true;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<AddCardDialogComponent>,
    private cardService: CardService,
    private authTokenService: AuthTokenService,
    private snackBar: MatSnackBar,
    private planLimitsService: PlanLimitsService,
    private featureControlService: FeatureControlService
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
    
    // Cargar límites
    this.loadLimitsInfo();
    
    // Cargar información del plan
    this.loadPlanInfo();
    
    // Carga dinámica de tipos y bancos
    this.cardTypes = (await firstValueFrom(this.cardService.getCardTypes()))
    .filter(type => type.name.toLowerCase() !== 'efectivo');

    this.banks = await firstValueFrom(this.cardService.getBanks());
  }

  loadLimitsInfo(): void {
    // Cargar información de límites
    this.planLimitsService.currentUsage$.subscribe({
      next: (usage) => {
        this.limitsInfo = usage;
      },
      error: (error) => {
        console.error('Error al cargar límites:', error);
      }
    });
  }

  loadPlanInfo(): void {
    // Cargar información del plan actual
    this.featureControlService.featureControl$.subscribe(control => {
      if (control) {
        this.currentPlanName = control.planName;
        
        // Controlar qué pestañas mostrar según el plan
        this.showAutomaticTab = ['premium', 'enterprise'].includes(control.planName.toLowerCase());
        this.showManualTab = true; // Siempre mostrar manual
        
        // Si no se puede mostrar automático, cambiar a manual por defecto
        if (!this.showAutomaticTab && this.activeTab === 'automatic') {
          this.activeTab = 'manual';
        }
      }
    });
  }

  getProgressPercentage(limitKey: string): number {
    if (!this.limitsInfo || !this.limitsInfo[limitKey]) return 0;
    const limit = this.limitsInfo[limitKey];
    return Math.min((limit.used / limit.limit) * 100, 100);
  }

  displayLimitNotification(data: LimitNotificationData): void {
    this.limitNotificationData = data;
    this.showLimitNotification = true;
  }

  hideLimitNotification(): void {
    this.showLimitNotification = false;
  }

  upgradePlan(): void {
    window.location.href = '/plans';
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

    // Verificar límites antes de agregar tarjeta
    this.planLimitsService.getLimitStatusInfo(PLAN_LIMITS.MAX_CARDS).subscribe({
      next: (limitStatus) => {
        if (limitStatus.currentUsage >= limitStatus.limit) {
          this.displayLimitNotification({
            type: 'error',
            title: 'Límite de Tarjetas Alcanzado',
            message: `Has alcanzado el límite de ${limitStatus.limit} tarjetas activas. Actualiza tu plan para agregar más tarjetas.`,
            limit: limitStatus.limit,
            current: limitStatus.currentUsage,
            showUpgradeButton: true
          });
          return;
        }

        // Continuar con la sincronización
        this.proceedWithScraperSync();
      },
      error: (error) => {
        console.error('Error al verificar límites:', error);
        // Continuar sin verificación en caso de error
        this.proceedWithScraperSync();
      }
    });
  }

  private proceedWithScraperSync(): void {
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

    // Verificar límites antes de agregar tarjeta manual
    this.planLimitsService.getLimitStatusInfo(PLAN_LIMITS.MAX_CARDS).subscribe({
      next: (limitStatus) => {
        if (limitStatus.currentUsage >= limitStatus.limit) {
          this.displayLimitNotification({
            type: 'error',
            title: 'Límite de Tarjetas Alcanzado',
            message: `Has alcanzado el límite de ${limitStatus.limit} tarjetas activas. Actualiza tu plan para agregar más tarjetas.`,
            limit: limitStatus.limit,
            current: limitStatus.currentUsage,
            showUpgradeButton: true
          });
          return;
        }

        // Continuar con la creación manual
        this.proceedWithManualCard();
      },
      error: (error) => {
        console.error('Error al verificar límites:', error);
        // Continuar sin verificación en caso de error
        this.proceedWithManualCard();
      }
    });
  }

  private proceedWithManualCard(): void {
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

  // Método para cambiar entre tabs
  setActiveTab(tab: 'automatic' | 'manual'): void {
    this.activeTab = tab;
    // Limpiar errores al cambiar de tab
    this.error = null;
    this.manualError = null;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
} 