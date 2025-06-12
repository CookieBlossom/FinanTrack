import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MovementService } from '../../../services/movement.service';
import { CategoryService } from '../../../services/category.service';
import { Category } from '../../../models/category.model';

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
    MatSelectModule
  ]
})
export class AddCashComponent {
  cashForm: FormGroup;
  categories: Category[] = [];
  methodOptions = ['Caja chica', 'Banca', 'Cheque', 'Transferencia', 'Otro'];
  typeOptions = ['income', 'expense'];
  isLoading = false;

  constructor(
    private fb: FormBuilder,
    private movementService: MovementService,
    private categoryService: CategoryService,
    public dialogRef: MatDialogRef<AddCashComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.cashForm = this.fb.group({
      categoryId: ['', Validators.required],
      description: ['', Validators.required],
      amount: [0, [Validators.required, Validators.min(1)]],
      transactionDate: [new Date().toISOString().substring(0, 10), Validators.required],
      movementType: ['expense', Validators.required]
    });

    this.loadCategories();
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

  submit() {
    if (this.cashForm.invalid) {
      this.cashForm.markAllAsTouched();
      return;
    }

    const formValue = this.cashForm.value;
    const payload = {
      ...formValue,
      movementSource: 'manual',
      useCashCard: true // para que el backend asocie automáticamente la tarjeta "Efectivo"
    };

    this.isLoading = true;

    this.movementService.addMovement(payload).subscribe({
      next: (res) => this.dialogRef.close(res),
      error: (err) => {
        console.error('Error al agregar movimiento en efectivo:', err);
        this.isLoading = false;
      }
    });
  }

  cancel() {
    this.dialogRef.close(false);
  }
}