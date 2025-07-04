import { Component, Inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MovementService } from '../../../services/movement.service';
import { CategoryService } from '../../../services/category.service';
import { CategorizationService, CategorizationResult } from '../../../services/categorization.service';
import { Category } from '../../../models/category.model';
import { PlanLimitsService } from '../../../services/plan-limits.service';
import { LimitNotificationComponent, LimitNotificationData } from '../../../shared/components/limit-notification/limit-notification.component';
import { PLAN_LIMITS } from '../../../models/plan.model';
import { PlanLimitAlertService } from '../../../shared/services/plan-limit-alert.service';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-add-cash',
  standalone: true,
  templateUrl: './add-cash.component.html',
  styleUrls: ['./add-cash.component.css'],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    MatIconModule,
    MatProgressSpinnerModule,
    LimitNotificationComponent
  ]
})
export class AddCashComponent implements OnDestroy {
  cashForm: FormGroup;
  categories: Category[] = [];
  methodOptions = ['Caja chica', 'Banca', 'Cheque', 'Transferencia', 'Otro'];
  typeOptions = ['income', 'expense'];
  isLoading = false;
  minDate: string; // Fecha mínima para el input de fecha
  
  // 🔒 Variables de protección contra múltiples ejecuciones
  isProcessing = false; // Público para usar en template
  private hasSubmitted = false;
  private componentDestroyed = false;
  private destroy$ = new Subject<void>();
  private processingId: string | null = null;

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

  // Variables para categorización automática
  categorizationResult: CategorizationResult | null = null;
  showCategorizationSuggestion = false;
  isCategorizationEnabled = false;

  constructor(
    private fb: FormBuilder,
    private movementService: MovementService,
    private categoryService: CategoryService,
    private categorizationService: CategorizationService,
    public dialogRef: MatDialogRef<AddCashComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private snackBar: MatSnackBar,
    private planLimitsService: PlanLimitsService,
    private planLimitAlertService: PlanLimitAlertService,
    private router: Router
  ) {
    // Obtener fecha de hoy como valor por defecto
    const today = new Date().toISOString().split('T')[0];
    this.minDate = '2000-01-01'; // Fecha mínima
    
    this.cashForm = this.fb.group({
      categoryId: ['', Validators.required],
      paymentMethod: ['', Validators.required],
      description: ['', Validators.required],
      amount: ['', [Validators.required, Validators.pattern(/^[1-9][0-9]*$/)]],
      transactionDate: [today, [Validators.required, this.minDateValidator.bind(this)]],
      movementType: ['expense', Validators.required]
    });

    this.loadCategories();
    this.loadLimitsInfo();
    this.setupCategorizationWatcher();
  }

  ngOnDestroy() {
    console.log('🔄 [AddCash] Destruyendo componente');
    this.componentDestroyed = true;
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadCategories(): void {
    this.categoryService.getUserCategories().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (cats) => {
        this.categories = cats;
      },
      error: (err) => {
        console.error('Error al cargar categorías:', err.message);
      }
    });
  }

  loadLimitsInfo(): void {
    // Cargar información de límites
    this.planLimitsService.currentUsage$.pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (usage) => {
        this.limitsInfo = usage;
      },
      error: (error) => {
        console.error('Error al cargar límites:', error);
      }
    });
  }

  // Validador personalizado para fecha mínima (desde año 2000)
  private minDateValidator(control: any) {
    if (!control.value) {
      return null;
    }
    const selectedDate = new Date(control.value);
    const minDate = new Date(2000, 0, 1); // 1 enero 2000
    return selectedDate < minDate ? { minDate: true } : null;
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

  // Método para abrir el selector de fecha
  openDatePicker(): void {
    const dateInput = document.querySelector('.cash-date-input') as HTMLInputElement;
    if (dateInput) {
      dateInput.showPicker();
    }
  }

  submit() {
    // 🔒 Múltiples protecciones contra ejecuciones duplicadas
    if (this.componentDestroyed) {
      console.log('🔒 [AddCash] Componente destruido, ignorando...');
      return;
    }

    if (this.isProcessing || this.hasSubmitted) {
      console.log('🔒 [AddCash] Ya se está procesando o ya se envió, ignorando...');
      return;
    }

    if (this.cashForm.invalid) {
      this.cashForm.markAllAsTouched();
      return;
    }

    // Generar ID único para este procesamiento
    const currentProcessingId = `cash-processing-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.processingId = currentProcessingId;
    this.isProcessing = true;
    this.hasSubmitted = true;
    
    console.log(`🔒 [AddCash] Iniciando procesamiento único ID: ${currentProcessingId}`);

    // Verificar límites antes de crear el movimiento
    this.planLimitsService.getLimitStatusInfo(PLAN_LIMITS.MANUAL_MOVEMENTS).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (limitStatus) => {
        // Verificar que este procesamiento sigue siendo válido
        if (this.processingId !== currentProcessingId || this.componentDestroyed) {
          console.log('🔒 [AddCash] Procesamiento obsoleto, ignorando...');
          return;
        }

        // Si el límite es -1, significa que es ilimitado
        if (limitStatus.limit === -1) {
          // Continuar con la creación del movimiento sin verificar límites
          this.createMovement(currentProcessingId);
          return;
        }
        
        // Verificar límite solo si no es ilimitado
        if (limitStatus.currentUsage >= limitStatus.limit) {
          // Mostrar alerta modal en lugar de notificación
          this.planLimitAlertService.showMovementLimitAlert(limitStatus.currentUsage, limitStatus.limit).pipe(
            takeUntil(this.destroy$)
          ).subscribe({
            next: (result) => {
              if (result.action === 'upgrade') {
                this.router.navigate(['/plans']);
              }
              this.resetProcessingState();
            }
          });
          return;
        }

        // Continuar con la creación del movimiento
        this.createMovement(currentProcessingId);
      },
      error: (error) => {
        console.error('Error al verificar límites:', error);
        if (this.processingId === currentProcessingId && !this.componentDestroyed) {
          // Continuar sin verificación en caso de error
          this.createMovement(currentProcessingId);
        }
      }
    });
  }

  private resetProcessingState(): void {
    this.isProcessing = false;
    this.hasSubmitted = false;
    this.processingId = null;
    console.log('🔒 [AddCash] Estado de procesamiento reseteado');
  }

  private createMovement(processingId?: string) {
    // 🔒 Verificar que el procesamiento sigue siendo válido
    if (processingId && this.processingId !== processingId) {
      console.log('🔒 [AddCash] Procesamiento obsoleto en createMovement, ignorando...');
      return;
    }

    if (this.componentDestroyed) {
      console.log('🔒 [AddCash] Componente destruido en createMovement, ignorando...');
      return;
    }

    console.log('🚀 [AddCash] Iniciando creación de movimiento en efectivo');
    const formValue = this.cashForm.value;
    
    // Combinar método de pago y descripción para el campo description final
    const finalDescription = `${formValue.paymentMethod} - ${formValue.description}`;
    
    // Usar parseInt para números enteros
    const amount = parseInt(formValue.amount.toString(), 10);
    
    const payload = {
      categoryId: formValue.categoryId,
      description: finalDescription,
      amount: amount, // Usar parseInt en lugar de Number
      transactionDate: formValue.transactionDate,
      movementType: formValue.movementType,
      movementSource: 'manual' as const,
      useCashCard: true // para que el backend asocie automáticamente la tarjeta "Efectivo"
    } as any;

    console.log('📤 [AddCash] Enviando datos al backend:', payload);
    this.isLoading = true;

    this.movementService.addMovement(payload).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (res) => {
        // Verificar que el procesamiento sigue siendo válido
        if (processingId && this.processingId !== processingId) {
          console.log('🔒 [AddCash] Procesamiento obsoleto en respuesta, ignorando...');
          return;
        }

        console.log('✅ [AddCash] Movimiento en efectivo creado exitosamente');
        this.snackBar.open('Movimiento en efectivo agregado exitosamente', 'Cerrar', { duration: 3000 });
        this.resetProcessingState();
        
        if (!this.componentDestroyed) {
          this.dialogRef.close(true); // Cerrar con true para indicar que se agregó exitosamente
        }
      },
      error: (err) => {
        // Verificar que el procesamiento sigue siendo válido
        if (processingId && this.processingId !== processingId) {
          console.log('🔒 [AddCash] Procesamiento obsoleto en error, ignorando...');
          return;
        }

        console.error('❌ [AddCash] Error al agregar movimiento en efectivo:', err);
        this.snackBar.open('Error al agregar el movimiento', 'Cerrar', { duration: 3000 });
        this.resetProcessingState();
        this.isLoading = false;
      }
    });
  }

  cancel() {
    this.dialogRef.close(false);
  }

  setupCategorizationWatcher(): void {
    // Observar cambios en el campo de descripción
    this.cashForm.get('description')?.valueChanges.pipe(
      debounceTime(500), // Esperar 500ms después del último cambio
      distinctUntilChanged(), // Solo procesar si el valor realmente cambió
      takeUntil(this.destroy$)
    ).subscribe(description => {
      if (description && description.trim().length >= 3) {
        this.performCategorization(description);
      } else {
        this.clearCategorizationResult();
      }
    });
  }

  performCategorization(description: string): void {
    this.categorizationService.categorizeDescription(description).pipe(
      takeUntil(this.destroy$)
    ).subscribe(result => {
      this.categorizationResult = result;
      this.showCategorizationSuggestion = result.found && result.confidence > 0.3;
      
      // Si se encuentra una categoría con alta confianza, sugerirla automáticamente
      if (result.found && result.confidence > 0.6 && result.category) {
        this.isCategorizationEnabled = true;
      }
    });
  }

  clearCategorizationResult(): void {
    this.categorizationResult = null;
    this.showCategorizationSuggestion = false;
    this.isCategorizationEnabled = false;
  }

  applySuggestedCategory(): void {
    if (this.categorizationResult?.category) {
      this.cashForm.patchValue({
        categoryId: this.categorizationResult.category.id
      });
      this.showCategorizationSuggestion = false;
    }
  }

  dismissSuggestion(): void {
    this.showCategorizationSuggestion = false;
  }

  getConfidencePercentage(): number {
    return this.categorizationResult ? Math.round(this.categorizationResult.confidence * 100) : 0;
  }

  getMatchedKeywordsText(): string {
    return this.categorizationResult?.matchedKeywords.join(', ') || '';
  }
}