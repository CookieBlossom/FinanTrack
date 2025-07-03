import { Component, Inject } from '@angular/core';
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
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

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
export class AddCashComponent {
  cashForm: FormGroup;
  categories: Category[] = [];
  methodOptions = ['Caja chica', 'Banca', 'Cheque', 'Transferencia', 'Otro'];
  typeOptions = ['income', 'expense'];
  isLoading = false;
  minDate: string; // Fecha mínima para el input de fecha

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

  loadCategories(): void {
    this.categoryService.getUserCategories().subscribe({
      next: (cats) => {
        this.categories = cats;
        console.log('Categorías cargadas:', this.categories);
      },
      error: (err) => {
        console.error('Error al cargar categorías:', err.message);
      }
    });
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
    if (this.cashForm.invalid) {
      this.cashForm.markAllAsTouched();
      return;
    }

    // Verificar límites antes de crear el movimiento
    this.planLimitsService.getLimitStatusInfo(PLAN_LIMITS.MANUAL_MOVEMENTS).subscribe({
      next: (limitStatus) => {
        if (limitStatus.currentUsage >= limitStatus.limit) {
          // Mostrar alerta modal en lugar de notificación
          this.planLimitAlertService.showMovementLimitAlert(limitStatus.currentUsage, limitStatus.limit).subscribe({
            next: (result) => {
              if (result.action === 'upgrade') {
                this.router.navigate(['/plans']);
              }
              // Si es dismiss, no hacer nada y dejar que el usuario continúe
            }
          });
          return;
        }

        // Continuar con la creación del movimiento
        this.createMovement();
      },
      error: (error) => {
        console.error('Error al verificar límites:', error);
        // Continuar sin verificación en caso de error
        this.createMovement();
      }
    });
  }

  private createMovement() {
    const formValue = this.cashForm.value;
    console.log('Valores del formulario:', formValue);
    console.log('Monto del formulario:', formValue.amount, 'tipo:', typeof formValue.amount);
    
    // Obtener el valor directo del control para debugging
    const amountControl = this.cashForm.get('amount');
    console.log('Valor del control amount:', amountControl?.value, 'tipo:', typeof amountControl?.value);
    
    // Combinar método de pago y descripción para el campo description final
    const finalDescription = `${formValue.paymentMethod} - ${formValue.description}`;
    
    // Usar parseInt para números enteros
    const amount = parseInt(formValue.amount.toString(), 10);
    console.log('Monto después de parseInt:', amount, 'tipo:', typeof amount);
    
    const payload = {
      categoryId: formValue.categoryId,
      description: finalDescription,
      amount: amount, // Usar parseInt en lugar de Number
      transactionDate: formValue.transactionDate,
      movementType: formValue.movementType,
      movementSource: 'manual' as const,
      useCashCard: true // para que el backend asocie automáticamente la tarjeta "Efectivo"
    } as any;
    
    console.log('Payload a enviar:', payload);
    console.log('Monto en payload:', payload.amount, 'tipo:', typeof payload.amount);

    this.isLoading = true;

    this.movementService.addMovement(payload).subscribe({
      next: (res) => {
        this.snackBar.open('Movimiento en efectivo agregado exitosamente', 'Cerrar', { duration: 3000 });
        this.dialogRef.close(true); // Cerrar con true para indicar que se agregó exitosamente
      },
      error: (err) => {
        console.error('Error al agregar movimiento en efectivo:', err);
        this.snackBar.open('Error al agregar el movimiento', 'Cerrar', { duration: 3000 });
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
      distinctUntilChanged() // Solo procesar si el valor realmente cambió
    ).subscribe(description => {
      if (description && description.trim().length >= 3) {
        this.performCategorization(description);
      } else {
        this.clearCategorizationResult();
      }
    });
  }

  performCategorization(description: string): void {
    this.categorizationService.categorizeDescription(description).subscribe(result => {
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