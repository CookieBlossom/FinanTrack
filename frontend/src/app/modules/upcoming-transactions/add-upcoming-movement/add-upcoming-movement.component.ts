import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { ProjectedMovementService } from '../../../services/projected-movement.service';
import { CardService } from '../../../services/card.service';
import { CategoryService } from '../../../services/category.service';
import { AuthTokenService } from '../../../services/auth-token.service';
import { ProjectedMovementCreate } from '../../../models/projected-movement.model';
import { Card } from '../../../models/card.model';
import { Category } from '../../../models/category.model';

@Component({
  selector: 'app-add-upcoming-movement',
  templateUrl: './add-upcoming-movement.component.html',
  styleUrls: ['./add-upcoming-movement.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule
  ]
})
export class AddUpcomingMovementComponent implements OnInit, OnDestroy {
  upcomingForm: FormGroup;
  cards: Card[] = [];
  categories: Category[] = [];
  isLoading = false;
  activeTab = 'single'; // 'single' | 'recurring'
  minDate: string; // Fecha mínima para el input de fecha
  private destroy$ = new Subject<void>();

  // Opciones para tipos de movimiento
  movementTypes = [
    { value: 'expense', label: 'Gasto', icon: '💸' },
    { value: 'income', label: 'Ingreso', icon: '💰' }
  ];

  // Opciones para tipos de recurrencia
  recurrenceTypes = [
    { value: null, label: 'Sin recurrencia', icon: '📅' },
    { value: 'weekly', label: 'Semanal', icon: '📅' },
    { value: 'monthly', label: 'Mensual', icon: '📅' },
    { value: 'yearly', label: 'Anual', icon: '📅' }
  ];

  // Opciones para probabilidad
  probabilityOptions = [
    { value: 25, label: '25% - Baja probabilidad' },
    { value: 50, label: '50% - Probabilidad media' },
    { value: 75, label: '75% - Alta probabilidad' },
    { value: 100, label: '100% - Seguro' }
  ];

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<AddUpcomingMovementComponent>,
    private projectedMovementService: ProjectedMovementService,
    private cardService: CardService,
    private categoryService: CategoryService,
    private authTokenService: AuthTokenService,
    private snackBar: MatSnackBar
  ) {
    // Obtener fecha mínima (hoy)
    this.minDate = new Date().toISOString().split('T')[0];
    
    this.upcomingForm = this.fb.group({
      description: ['', [Validators.required, Validators.minLength(3)]],
      amount: ['', [Validators.required, Validators.min(1)]],
      movementType: ['expense', Validators.required],
      expectedDate: [this.minDate, [Validators.required, this.minDateValidator(this.minDate)]],
      categoryId: [null],
      cardId: [null],
      probability: [75, Validators.required],
      recurrenceType: [null]
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

  async ngOnInit() {
    if (!this.authTokenService.hasToken()) {
      const errorMsg = 'No hay sesión activa. Por favor, inicia sesión nuevamente.';
      this.snackBar.open(errorMsg, 'Cerrar', { duration: 5000 });
      this.upcomingForm.disable();
      return;
    }

    try {
      // Cargar tarjetas y categorías
      this.cards = await firstValueFrom(this.cardService.getCards());
      this.categories = await firstValueFrom(this.categoryService.getUserCategories());
    } catch (error) {
      console.error('Error cargando datos:', error);
      this.snackBar.open('Error cargando datos', 'Cerrar', { duration: 3000 });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Cambiar entre tabs
  setActiveTab(tab: 'single' | 'recurring'): void {
    this.activeTab = tab;
    
    if (tab === 'single') {
      this.upcomingForm.patchValue({ recurrenceType: null });
    } else {
      this.upcomingForm.patchValue({ recurrenceType: 'monthly' });
    }
  }

  // Enviar formulario
  onSubmit(): void {
    if (this.upcomingForm.invalid) {
      Object.keys(this.upcomingForm.controls).forEach(key => {
        this.upcomingForm.get(key)?.markAsTouched();
      });
      return;
    }

    if (!this.authTokenService.hasToken()) {
      const errorMsg = 'No hay sesión activa. Por favor, inicia sesión nuevamente.';
      this.snackBar.open(errorMsg, 'Cerrar', { duration: 5000 });
      return;
    }

    this.isLoading = true;

    const formValue = this.upcomingForm.value;
    
    // Limpiar valores vacíos de selects
    const categoryId = formValue.categoryId && formValue.categoryId !== '' ? formValue.categoryId : undefined;
    const cardId = formValue.cardId && formValue.cardId !== '' ? formValue.cardId : undefined;
    const recurrenceType = formValue.recurrenceType && formValue.recurrenceType !== '' ? formValue.recurrenceType : null;
    
    const movementData: ProjectedMovementCreate = {
      description: formValue.description,
      amount: parseFloat(formValue.amount),
      movementType: formValue.movementType,
      expectedDate: new Date(formValue.expectedDate),
      categoryId: categoryId,
      cardId: cardId,
      probability: formValue.probability,
      recurrenceType: recurrenceType
    };

    this.projectedMovementService.createProjectedMovement(movementData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.snackBar.open('Movimiento futuro agregado exitosamente', 'Cerrar', { duration: 3000 });
          this.dialogRef.close(true);
        },
        error: (error) => {
          this.isLoading = false;
          const errorMessage = this.getErrorMessage(error) || 'Error al crear el movimiento futuro';
          this.snackBar.open(errorMessage, 'Cerrar', { duration: 5000 });
        }
      });
  }

  // Cancelar
  onCancel(): void {
    this.dialogRef.close();
  }

  // Obtener mensaje de error
  private getErrorMessage(error: any): string {
    if (error.error?.message) {
      return error.error.message;
    }
    if (error.message) {
      return error.message;
    }
    return 'Error desconocido';
  }

  // Obtener etiqueta del tipo de movimiento
  getMovementTypeLabel(value: string): string {
    const type = this.movementTypes.find(t => t.value === value);
    return type ? type.label : value;
  }

  // Obtener icono del tipo de movimiento
  getMovementTypeIcon(value: string): string {
    const type = this.movementTypes.find(t => t.value === value);
    return type ? type.icon : '📝';
  }

  // Obtener etiqueta de recurrencia
  getRecurrenceLabel(value: string | null): string {
    const recurrence = this.recurrenceTypes.find(r => r.value === value);
    return recurrence ? recurrence.label : 'Sin recurrencia';
  }

  // Obtener icono de recurrencia
  getRecurrenceIcon(value: string | null): string {
    const recurrence = this.recurrenceTypes.find(r => r.value === value);
    return recurrence ? recurrence.icon : '📅';
  }
} 