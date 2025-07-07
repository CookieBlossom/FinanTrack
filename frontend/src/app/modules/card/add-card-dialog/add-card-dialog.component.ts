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
import { WebSocketService, ConnectionStatus } from '../../../services/websocket.service';

interface CardCredentials {
  rut: string;
  password: string;
  site?: string;
}

interface TaskStatus {
  id: string;
  userId: number;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'cancelling';
  message: string;
  progress: number;
  result?: any;
  createdAt: string;
  updatedAt: string;
  error?: string;
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
    private scraperService: ScraperService,
    private wsService: WebSocketService
  ) {
    // Scraper form
    this.cardForm = this.fb.group({
      rut: ['', [
        Validators.required,
        (control: AbstractControl) => {
          const value = control.value;
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
    this.loadLimitsInfo();
    this.loadPlanInfo();
    this.cardTypes = (await firstValueFrom(this.cardService.getCardTypes()))
    .filter(type => type.name.toLowerCase() !== 'efectivo');
    this.banks = await firstValueFrom(this.cardService.getBanks());
  }

  loadLimitsInfo(): void {
    this.planLimitsService.currentUsage$.subscribe({
      next: (usage) => {
        this.limitsInfo = usage;
      },
      error: (error) => {
        // Error silencioso
      }
    });
  }

  loadPlanInfo(): void {
    // Cargar información del plan actual
    this.featureControlService.featureControl$.subscribe(control => {
      if (control) {
        this.currentPlanName = control.planName;
        this.showAutomaticTab = ['premium', 'pro'].includes(control.planName.toLowerCase());
        this.showManualTab = true; // Siempre mostrar manual
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
      const errorMessage = 'No hay sesión activa. Por favor, inicia sesión nuevamente.';
      this.error = errorMessage;
      this.snackBar.open(errorMessage, 'Cerrar', { duration: 5000 });
      return;
    }
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
          this.currentTaskId = response.taskId;
          this.statusMessage = 'Iniciando scraper...';
          this.progress = 10;
          this.monitorScrapingProgress(response.taskId);
        }
      },
      error: (err) => {
        const errorMessage = this.getErrorMessageFromError(err) || 'Error al iniciar el scraper.';
        this.handleTaskError(errorMessage);
      }
    });
  }

  private monitorScrapingProgress(taskId: string): void {
    console.log(`🔍 [ADD-CARD] Iniciando monitoreo de tarea: ${taskId}`);
    
    // Suscribirse a errores de conexión
    this.wsService.getConnectionErrors().pipe(
      takeUntil(this.destroy$)
    ).subscribe((error: string) => {
      console.error(`❌ [ADD-CARD] Error de conexión:`, error);
      this.snackBar.open(`Error de conexión: ${error}`, 'Reintentar', {
        duration: 0,
        panelClass: ['error-snackbar']
      }).onAction().subscribe(() => {
        this.retrySync();
      });
    });

    // Monitorear estado de conexión
    this.wsService.getConnectionStatus().pipe(
      takeUntil(this.destroy$)
    ).subscribe((status: ConnectionStatus) => {
      if (!status.connected && status.reconnecting) {
        this.statusMessage = `Reconectando... (Intento ${status.reconnectAttempt || 1}/5)`;
      }
      if (!status.connected && status.error && !status.reconnecting) {
        this.handleTaskError(new Error(status.error));
      }
    });

    // Primero intentar obtener el estado actual
    this.scraperService.getTaskStatus(taskId).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (initialStatus) => {
        this.updateTaskStatus(initialStatus);
      },
      error: (err) => {
        console.error(`❌ [ADD-CARD] Error al obtener estado inicial:`, err);
        this.handleTaskError(err);
      }
    });

    // Luego suscribirse a las actualizaciones
    this.scraperService.monitorTask(taskId).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (status) => {
        this.updateTaskStatus(status);
      },
      error: (err) => {
        console.error(`❌ [ADD-CARD] Error en monitoreo de tarea ${taskId}:`, err);
        this.handleTaskError(err);
      },
      complete: () => {
        console.log(`🏁 [ADD-CARD] Monitoreo completado para tarea: ${taskId}`);
        // Si el monitoreo se completa sin error y sin estado final, verificar estado
        if (this.loading) {
          this.verifyFinalStatus(taskId);
        }
      }
    });
  }

  private updateTaskStatus(status: any): void {
    console.log(`🔄 [ADD-CARD] Actualizando estado:`, status);
    
    // Actualizar progreso y mensaje
    this.progress = status.progress || 0;
    this.statusMessage = this.getStatusMessage(status.status);

    // Manejar estados finales
    if (status.status === 'completed') {
      this.handleTaskCompletion(status);
    } else if (status.status === 'failed') {
      this.handleTaskFailure(status);
    } else if (status.status === 'cancelled') {
      this.handleTaskCancellation();
    } else {
      console.log(`🔄 [ADD-CARD] Tarea en progreso: ${status.status} (${this.progress}%)`);
    }
  }

  private handleTaskError(error: any): void {
    console.error(`❌ [ADD-CARD] Error en tarea:`, error);
    this.currentTaskId = null;
    const errorMessage = this.getErrorMessageFromError(error) || 'Error al monitorear el progreso.';
    this.error = errorMessage;
    this.canRetry = true;
    this.loading = false;
    
    this.snackBar.open(errorMessage, 'Cerrar', { 
      duration: 7000,
      panelClass: ['error-snackbar']
    });
  }

  private handleTaskFailure(status: any): void {
    console.error(`❌ [ADD-CARD] Tarea falló:`, status);
    this.currentTaskId = null;
    const errorMessage = status.error || status.message || 'Error durante la sincronización';
    this.error = errorMessage;
    this.canRetry = true;
    this.loading = false;
    
    this.snackBar.open(errorMessage, 'Cerrar', { 
      duration: 7000,
      panelClass: ['error-snackbar']
    });
  }

  private handleTaskCancellation(): void {
    console.log(`🚫 [ADD-CARD] Tarea cancelada`);
    this.currentTaskId = null;
    this.loading = false;
    this.progress = 0;
    
    this.snackBar.open('Sincronización cancelada', 'Cerrar', { 
      duration: 3000,
      panelClass: ['warning-snackbar']
    });
  }

  private handleTaskCompletion(status: any): void {
    console.log(`✅ [ADD-CARD] Tarea completada exitosamente`);
    this.currentTaskId = null;
    this.loading = false;
    this.progress = 100;
    
    // Mostrar mensaje de éxito
    this.snackBar.open('¡Sincronización completada exitosamente!', 'Cerrar', { 
      duration: 10000,  // Aumentar duración del mensaje
      panelClass: ['success-snackbar']
    });
    setTimeout(() => {
      console.log('🏁 [ADD-CARD] Cerrando diálogo después de completar tarea');
      this.dialogRef.close(true);
    }, 5000);  // Aumentar a 5 segundos
  }

  private verifyFinalStatus(taskId: string): void {
    this.scraperService.getTaskStatus(taskId).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (finalStatus) => {
        this.updateTaskStatus(finalStatus);
      },
      error: (err) => {
        console.error(`❌ [ADD-CARD] Error al verificar estado final:`, err);
        this.handleTaskError(err);
      }
    });
  }

  getStatusMessage(status: string): string {
    const messages: { [key: string]: string } = {
      'pending': 'Esperando inicio...',
      'processing': 'Procesando información...',
      'completed': '¡Sincronización completada!',
      'failed': 'Error en la sincronización',
      'cancelled': 'Sincronización cancelada',
      'initializing': 'Iniciando sincronización...',
      'logging_in': 'Iniciando sesión en el banco...',
      'fetching_data': 'Obteniendo información de la cuenta...',
      'connecting': 'Conectando con el servidor...',
      'reconnecting': 'Reconectando...',
      'connection_lost': 'Se perdió la conexión, reconectando...'
    };
    return messages[status] || status;
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
        const errorMessage = err.message || 'Error al crear tarjeta';
        this.manualError = errorMessage;
        this.snackBar.open(errorMessage, 'Cerrar', { duration: 5000 });
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