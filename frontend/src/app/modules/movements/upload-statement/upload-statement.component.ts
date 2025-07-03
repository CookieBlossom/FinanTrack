import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MovementService } from '../../../services/movement.service';
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
  selector: 'app-upload-statement',
  templateUrl: './upload-statement.component.html',
  styleUrls: ['./upload-statement.component.css'],
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
export class UploadStatementComponent {
  selectedFile: File | null = null;
  uploadError: string | null = null;
  isUploading = false;

  constructor(
    private dialogRef: MatDialogRef<UploadStatementComponent>,
    private movementService: MovementService
  ) {}

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      
      // Validar tipo de archivo
      if (file.type !== 'application/pdf') {
        this.uploadError = 'Solo se permiten archivos PDF';
        this.selectedFile = null;
        return;
      }

      // Validar tamaño (máximo 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB en bytes
      if (file.size > maxSize) {
        this.uploadError = 'El archivo no puede ser mayor a 10MB';
        this.selectedFile = null;
        return;
      }

      this.selectedFile = file;
      this.uploadError = null;
    }
  }

  upload(): void {
    if (!this.selectedFile) {
      this.uploadError = 'Debes seleccionar una cartola en PDF';
      return;
    }

    const formData = new FormData();
    formData.append('cartola', this.selectedFile);

    this.isUploading = true;
    this.movementService.uploadCartola(formData).subscribe({
      next: () => {
        this.dialogRef.close(true);
      },
      error: (err) => {
        let errorMessage = 'Error al cargar cartola';
        
        if (err.error?.message) {
          errorMessage = err.error.message;
        } else if (err.status === 413) {
          errorMessage = 'El archivo es demasiado grande';
        } else if (err.status === 415) {
          errorMessage = 'Formato de archivo no válido';
        } else if (err.status === 400) {
          errorMessage = 'La cartola no tiene el formato esperado de BancoEstado';
        }
        
        this.uploadError = errorMessage;
        this.isUploading = false;
      }
    });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}