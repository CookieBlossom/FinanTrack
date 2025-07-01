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
import { Category } from '../../../models/category.model';
import { PlanLimitsService } from '../../../services/plan-limits.service';
import { LimitNotificationComponent, LimitNotificationData } from '../../../shared/components/limit-notification/limit-notification.component';
import { PLAN_LIMITS } from '../../../models/plan.model';
import { PlanLimitAlertService } from '../../../shared/services/plan-limit-alert.service';
import { Router } from '@angular/router';

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

  constructor(
    private fb: FormBuilder,
    private movementService: MovementService,
    private categoryService: CategoryService,
    public dialogRef: MatDialogRef<AddCashComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private snackBar: MatSnackBar,
    private planLimitsService: PlanLimitsService,
    private planLimitAlertService: PlanLimitAlertService,
    private router: Router
  ) {
    // Obtener fecha mínima (hoy)
    this.minDate = new Date().toISOString().split('T')[0];
    
    this.cashForm = this.fb.group({
      categoryId: ['', Validators.required],
      description: ['', Validators.required],
      amount: [0, [Validators.required, Validators.min(1)]],
      transactionDate: [this.minDate, [Validators.required, this.minDateValidator(this.minDate)]],
      movementType: ['expense', Validators.required]
    });

    this.loadCategories();
    this.loadLimitsInfo();
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

  // Validador personalizado para fecha mínima
  private minDateValidator(minDate: string) {
    return (control: any) => {
      if (!control.value) {
        return null;
      }
      const selectedDate = new Date(control.value);
      const minDateObj = new Date(minDate);
      return selectedDate < minDateObj ? { minDate: true } : null;
    };
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
    const payload = {
      ...formValue,
      movementSource: 'manual',
      useCashCard: true // para que el backend asocie automáticamente la tarjeta "Efectivo"
    };

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
}