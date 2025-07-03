import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';

import { MovementService } from '../../../services/movement.service';
import { CategoryService } from '../../../services/category.service';
import { CardService } from '../../../services/card.service';
import { Movement } from '../../../models/movement.model';
import { Category } from '../../../models/category.model';
import { Card } from '../../../models/card.model';

@Component({
  selector: 'app-edit-movement-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule
  ],
  templateUrl: './edit-movement-dialog.component.html',
  styleUrls: ['./edit-movement-dialog.component.css']
})
export class EditMovementDialogComponent implements OnInit {
  editForm: FormGroup;
  categories$: Observable<Category[]>;
  cards$: Observable<Card[]>;
  isLoading = false;
  isCashMovement = false;
  methodOptions = ['Caja chica', 'Banca', 'Cheque', 'Transferencia', 'Otro'];
  originalPaymentMethod = '';
  originalDescription = '';
  constructor(
    private fb: FormBuilder,
    private movementService: MovementService,
    private categoryService: CategoryService,
    private cardService: CardService,
    public dialogRef: MatDialogRef<EditMovementDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { movement: Movement }
  ) {

    // Verificar si es movimiento en efectivo
    this.isCashMovement = data.movement.card?.nameAccount?.toLowerCase() === 'efectivo';

    // Si es movimiento en efectivo, separar método de pago y descripción
    if (this.isCashMovement && data.movement.description) {
      const parts = data.movement.description.split(' - ');
      if (parts.length >= 2) {
        this.originalPaymentMethod = parts[0];
        this.originalDescription = parts.slice(1).join(' - ');
      } else {
        // Si no tiene el formato esperado, usar la descripción completa
        this.originalPaymentMethod = 'Otro';
        this.originalDescription = data.movement.description;
      }
    }

    this.editForm = this.fb.group({
      paymentMethod: [this.isCashMovement ? this.originalPaymentMethod : '', this.isCashMovement ? [Validators.required] : []],
      description: [this.isCashMovement ? this.originalDescription : data.movement.description, [Validators.required, Validators.maxLength(255)]],
      amount: [Math.floor(Number(data.movement.amount)).toString(), [Validators.required, Validators.pattern(/^[1-9][0-9]*$/)]],
      movementType: [data.movement.movementType, [Validators.required]],
      categoryId: [data.movement.categoryId || data.movement.category?.id],
      cardId: [data.movement.cardId, [Validators.required]],
      transactionDate: [this.formatDateForInput(data.movement.transactionDate), [Validators.required]]
    });

    this.categories$ = this.categoryService.getUserCategories();
    this.cards$ = this.cardService.getCards();
  }

  ngOnInit(): void {}
  private formatDateForInput(date: string | Date): string {
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  }

  // Formatear fecha para enviar al backend (mantener la fecha local sin cambios de zona horaria)
  private formatDateForBackend(dateString: string): Date {
    const [year, month, day] = dateString.split('-');
    // Usar mediodía para evitar problemas de zona horaria
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0, 0);
  }
  onSubmit(): void {
    if (this.editForm.valid) {
      this.isLoading = true;
      const formData = this.editForm.value;
      
      // Preparar la descripción final
      let finalDescription = formData.description;
      if (this.isCashMovement && formData.paymentMethod) {
        finalDescription = `${formData.paymentMethod} - ${formData.description}`;
      }
      
      // Preparar los datos para el update
      const updateData = {
        description: finalDescription,
        amount: parseInt(formData.amount.toString(), 10), // Asegurar que sea número entero
        movementType: formData.movementType,
        categoryId: formData.categoryId || null,
        cardId: formData.cardId,
        transactionDate: this.formatDateForBackend(formData.transactionDate)
      };

      this.movementService.updateMovement(this.data.movement.id, updateData).subscribe({
        next: (updatedMovement) => {
          this.isLoading = false;
          this.dialogRef.close(updatedMovement);
        },
        error: (error) => {
          this.isLoading = false;
          console.error('Error al actualizar movimiento:', error);
          // Aquí podrías mostrar un mensaje de error al usuario
        }
      });
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  // Método para abrir el selector de fecha
  openDatePicker(): void {
    const dateInput = document.querySelector('.edit-date-input') as HTMLInputElement;
    if (dateInput) {
      dateInput.showPicker();
    }
  }

  // Formatear el monto para mostrar en formato de moneda
  formatAmount(amount: number): string {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP'
    }).format(amount);
  }
} 