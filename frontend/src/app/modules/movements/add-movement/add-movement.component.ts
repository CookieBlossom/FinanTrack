import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSelectModule } from '@angular/material/select';
import { MovementService } from '../../../services/movement.service';
import { CardService } from '../../../services/card.service';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Card } from '../../../models/card.model';

@Component({
  selector: 'app-add-movement',
  standalone: true,
  templateUrl: './add-movement.component.html',
  styleUrls: ['./add-movement.component.css'],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatTabsModule,
    MatIconModule,
    MatSelectModule,
    MatProgressSpinnerModule
  ],
})
export class AddMovementComponent implements OnInit {
  manualForm: FormGroup;
  selectedFile: File | null = null;
  uploadError: string | null = null;
  isUploading = false;
  cards: Card[] = [];

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<AddMovementComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private movementService: MovementService,
    private cardService: CardService,
    private snackBar: MatSnackBar
  ) {
    this.manualForm = this.fb.group({
      cardId: ['', Validators.required],
      transactionDate: ['', Validators.required],
      description: ['', Validators.required],
      amount: [0, [Validators.required, Validators.min(0)]],
      movementType: ['', Validators.required],
    });
  }

  ngOnInit() {
    this.loadCards();
  }

  normalizeCardName(name: string): string {
    return name
      .toUpperCase()
      .replace(/\s+/g, ' ')
      .replace(/[^A-Z0-9\s]/g, '')
      .trim();
  }

  loadCards() {
    this.cardService.getCards().subscribe(
      cards => {
        const seen = new Set();
        this.cards = cards.filter(card => {
          const normalized = this.normalizeCardName(card.nameAccount);
          if (seen.has(normalized)) return false;
          seen.add(normalized);
          card.nameAccount = normalized;
          return true;
        });
      },
      error => {
        console.error('Error al cargar tarjetas:', error);
        this.snackBar.open('Error al cargar las tarjetas', 'Cerrar', { duration: 3000 });
      }
    );
  }

  async isDuplicateMovement(): Promise<boolean> {
    const { cardId, description, transactionDate, amount } = this.manualForm.value;

    try {
      const movements = await this.movementService
        .getFilteredMovements({
          cardId: Number(cardId),
          startDate: new Date(transactionDate),
          endDate: new Date(transactionDate),
          movementSource: 'manual'
        })
        .toPromise();
      if (movements) {
        return movements.some(m =>
          m.description?.toLowerCase().trim() === description.toLowerCase().trim() &&
          Number(m.amount) === Number(amount)
        );
      }
      return false;
    } catch (error) {
      console.error('Error al validar duplicado:', error);
      return false;
    }
  }

  async onSubmit() {
    if (this.manualForm.valid) {
      const isDuplicate = await this.isDuplicateMovement();
      if (isDuplicate) {
        this.snackBar.open('Ya existe un movimiento similar en esta fecha', 'Cerrar', { duration: 3000 });
        return;
      }

      const movementData = {
        ...this.manualForm.value,
        movementSource: 'manual'
      };
      this.movementService.addMovement(movementData).subscribe({
        next: () => {
          this.snackBar.open('Movimiento agregado exitosamente', 'Cerrar', { duration: 3000 });
          this.dialogRef.close(true);
        },
        error: (error) => {
          console.error('Error al agregar movimiento:', error);
          this.snackBar.open(error.message || 'Error al agregar el movimiento', 'Cerrar', { duration: 3000 });
        }
      });
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      if (file.type !== 'application/pdf') {
        this.uploadError = 'Solo se permiten archivos PDF';
        this.selectedFile = null;
        return;
      }
      this.selectedFile = file;
      this.uploadError = null;
    }
  }

  onUploadCartola(): void {
    if (!this.selectedFile) {
      this.uploadError = 'Debes seleccionar una cartola en PDF';
      return;
    }

    const formData = new FormData();
    formData.append('cartola', this.selectedFile);

    this.isUploading = true;
    this.uploadError = null;

    this.movementService.uploadCartola(formData).subscribe({
      next: () => {
        this.snackBar.open('¡Cartola procesada exitosamente!', 'Cerrar', { duration: 3000 });
        this.dialogRef.close(true);
      },
      error: (err) => {
        console.error('Error al procesar cartola:', err);
        this.uploadError = err.error?.message || 'Ocurrió un error al procesar la cartola';
        this.isUploading = false;
      }
    });
  }

  removeFile(): void {
    this.selectedFile = null;
    this.uploadError = null;
  }
}