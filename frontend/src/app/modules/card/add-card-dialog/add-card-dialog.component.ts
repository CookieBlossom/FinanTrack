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
import { PlanLimitAlertService } from '../../../shared/services/plan-limit-alert.service';
import { Router } from '@angular/router';
import { ScraperService } from '../../../services/scraper.service';

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
  currentTaskId: string | null = null; // Para rastrear la tarea activa (público para template)
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
    private featureControlService: FeatureControlService,
    private planLimitAlertService: PlanLimitAlertService,
    private router: Router,
    private scraperService: ScraperService
  ) {
    // Scraper form
    this.cardForm = this.fb.group({
      rut: ['', [
        Validators.required,
        (control: AbstractControl) => {
          const value = control.value;
          
          // Solo validar si el RUT tiene al menos 8 caracteres (formato mínimo)
          if (!value || value.length < 8) {
            return null; // No mostrar error hasta que tenga longitud mínima
          }
          
          return RutUtils.validate(value) ? null : { invalidRut: true };
        }
      ]],
      password: ['', [
        Validators.required,
        Validators.minLength(4)
      ]]
    });

    // Manual form
    this.manualForm = this.fb.group({
      nameAccount: ['', Validators.required],
      accountHolder: [''],
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
        this.showAutomaticTab = ['premium', 'pro'].includes(control.planName.toLowerCase());
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
    this.router.navigate(['/plans']);
  }

  // --- Scraper TAB
  onRutInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const formatted = RutUtils.format(input.value);
    input.value = formatted;
    // Actualizar el formulario con el valor formateado y permitir que se ejecuten las validaciones
    this.cardForm.get('rut')?.setValue(formatted);
  }
  getErrorMessage(field: string): string {
    const control = this.cardForm.get(field);
    if (!control) return '';
    
    if (control.hasError('required')) return `El ${field} es requerido`;
    if (field === 'rut' && control.hasError('invalidRut')) return 'Formato de RUT inválido. Ejemplo: 12.345.678-9';
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

    // Verificar límites usando datos ya cargados
    const cardLimit = this.limitsInfo?.max_cards?.limit;
    const cardsUsed = this.limitsInfo?.max_cards?.used || 0;
    
    // Solo verificar límite si no es ilimitado (-1) y se ha alcanzado el límite
    if (cardLimit !== -1 && cardsUsed >= cardLimit) {
      this.planLimitAlertService.showCardLimitAlert(cardsUsed, cardLimit).subscribe({
        next: (result) => {
          if (result.action === 'upgrade') {
            this.router.navigate(['/plans']);
          }
        }
      });
      return;
    }

    // Verificar también límites del scraper si están disponibles
    const scraperLimit = this.limitsInfo?.monthly_scrapes?.limit;
    const scrapesUsed = this.limitsInfo?.monthly_scrapes?.used || 0;
    
    if (scraperLimit !== -1 && scrapesUsed >= scraperLimit) {
      this.planLimitAlertService.showScraperLimitAlert(scrapesUsed, scraperLimit).subscribe({
        next: (result) => {
          if (result.action === 'upgrade') {
            this.router.navigate(['/plans']);
          }
        }
      });
      return;
    }

    // Continuar con la sincronización
    this.proceedWithScraperSync();
  }

  private proceedWithScraperSync(): void {
    this.loading = true;
    this.progress = 0;
    this.statusMessage = '';
    this.error = null;
    this.canRetry = false;

    const formValue = this.cardForm.value;
    const credentials = {
      rut: RutUtils.clean(formValue.rut), // RUT sin puntos ni guión para el scraper
      password: formValue.password,
      site: 'banco-estado' // Fijo para Banco Estado
    };
    // Iniciar el scraper
    this.scraperService.startScraping(credentials).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response) => {
        if (response.taskId) {
          this.currentTaskId = response.taskId; // Guardar ID de la tarea activa
          this.statusMessage = 'Iniciando scraper...';
          this.progress = 10;
          // Monitorear el progreso
          this.monitorScrapingProgress(response.taskId);
        }
      },
      error: (err) => {
        this.currentTaskId = null; // Limpiar tarea si falla al iniciar
        const errorMessage = this.getErrorMessageFromError(err) || 'Error al iniciar el scraper.';
        this.error = errorMessage;
        this.canRetry = true;
        this.loading = false;
        this.snackBar.open(errorMessage, 'Cerrar', { duration: 7000 });
      }
    });
  }

  private monitorScrapingProgress(taskId: string): void {
    this.scraperService.monitorTask(taskId).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (status) => {
        this.progress = status.progress;
        this.statusMessage = this.getStatusMessage(status.status);
        
        if (status.status === 'completed') {
          this.currentTaskId = null; // Limpiar tarea activa
          this.snackBar.open('¡Sincronización completada exitosamente!', 'Cerrar', { duration: 3000 });
          this.dialogRef.close(true);
        } else if (status.status === 'failed') {
          this.currentTaskId = null; // Limpiar tarea activa
          this.error = status.error || 'Error durante la sincronización';
          this.canRetry = true;
          this.loading = false;
        } else if (status.status === 'cancelled') {
          this.currentTaskId = null; // Limpiar tarea activa
          this.loading = false;
        }
      },
      error: (err) => {
        this.currentTaskId = null; // Limpiar tarea activa en caso de error
        const errorMessage = this.getErrorMessageFromError(err) || 'Error al monitorear el progreso.';
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

    // Verificar límites solo si no es ilimitado (-1) y se ha alcanzado el límite
    const cardLimit = this.limitsInfo?.max_cards?.limit;
    const cardsUsed = this.limitsInfo?.max_cards?.used || 0;
    
    if (cardLimit !== -1 && cardsUsed >= cardLimit) {
      this.planLimitAlertService.showCardLimitAlert(cardsUsed, cardLimit).subscribe({
        next: (result) => {
          if (result.action === 'upgrade') {
            this.router.navigate(['/plans']);
          }
        }
      });
      return;
    }
    
    this.proceedWithManualCard();
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
    // Si hay una tarea activa, cancelarla antes de cerrar
    if (this.currentTaskId) {
      this.scraperService.cancelTask(this.currentTaskId).subscribe({
        next: () => {
          this.currentTaskId = null;
          this.dialogRef.close();
        },
        error: (err) => {
          // Cerrar de todas formas aunque falle la cancelación
          this.currentTaskId = null;
          this.dialogRef.close();
        }
      });
    } else {
      this.dialogRef.close();
    }
  }
  retrySync(): void {
    this.error = null;
    this.canRetry = false;
    this.currentTaskId = null; // Limpiar tarea anterior antes de reintentar
    this.onSubmitScraper();
  }

  cancelCurrentTask(): void {
    if (this.currentTaskId) {
      this.scraperService.cancelTask(this.currentTaskId).subscribe({
        next: () => {
          this.currentTaskId = null;
          this.loading = false;
          this.error = null;
          this.statusMessage = '';
          this.progress = 0;
          this.snackBar.open('Sincronización cancelada', 'Cerrar', { duration: 3000 });
        },
        error: (err) => {
          this.error = 'Error al cancelar la sincronización';
          this.canRetry = true;
          this.loading = false;
        }
      });
    }
  }
  getStatusMessage(status: string): string {
    const messages: { [key: string]: string } = {
      'pending': 'Esperando inicio...',
      'processing': 'Procesando información...',
      'completed': 'Sincronización completada',
      'failed': 'Error en la sincronización',
      'cancelled': 'Sincronización cancelada',
      'initializing': 'Iniciando sincronización...',
      'logging_in': 'Iniciando sesión en el banco...',
      'fetching_data': 'Obteniendo información de la cuenta...'
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
    // Cancelar tarea activa si existe antes de destruir el componente
    if (this.currentTaskId) {
      this.scraperService.cancelTask(this.currentTaskId).subscribe({
        next: () => {
          // Tarea cancelada exitosamente
        },
        error: (err) => {
          // Error al cancelar, pero continuar con la destrucción
        }
      });
      this.currentTaskId = null;
    }
    
    this.destroy$.next();
    this.destroy$.complete();
  }
} 