import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { CardService } from '../../../services/card.service'; // ajusta el path según tu proyecto
import { Card } from '../../../models/card.model'; // ajusta el path según tu proyecto
import { Subject } from 'rxjs';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-edit-card-dialog',
  templateUrl: './edit-card-dialog.component.html',
  styleUrls: ['./edit-card-dialog.component.css'],
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
export class EditCardDialogComponent implements OnInit, OnDestroy {
  editCardForm: FormGroup;
  isLoading = false;
  error: string | null = null;
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<EditCardDialogComponent>,
    private cardService: CardService,
    @Inject(MAT_DIALOG_DATA) public card: Card
  ) {
    // Inicializa el formulario con los valores actuales de la tarjeta
    this.editCardForm = this.fb.group({
      accountHolder: [card.accountHolder || '', [Validators.maxLength(255)]],
      balance: [card.balance, [Validators.required]],
      statusAccount: [card.statusAccount, [Validators.required]]
    });
  }

  ngOnInit(): void {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSubmit(): void {
    if (this.editCardForm.invalid) return;
    this.error = null;

    const { accountHolder, balance, statusAccount } = this.editCardForm.value;

    this.cardService.updateCard(this.card.id, {
      accountHolder,
      balance,
      statusAccount
    }).subscribe({
      next: updatedCard => {
        this.dialogRef.close(updatedCard); // Puedes devolver la tarjeta actualizada si quieres
      },
      error: err => {
        this.error = err.message || 'Error al actualizar la tarjeta';
      }
    });
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
