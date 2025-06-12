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
  form: FormGroup;
  selectedFile: File | null = null;
  uploadError: string | null = null;
  isUploading = false;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<UploadStatementComponent>,
    private movementService: MovementService
  ) {
    this.form = this.fb.group({
      bank: ['', Validators.required]
    });
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

  upload(): void {
    if (this.form.invalid || !this.selectedFile) {
      this.uploadError = !this.selectedFile ? 'Debes seleccionar una cartola en PDF' : null;
      return;
    }

    const formData = new FormData();
    formData.append('bank', this.form.value.bank);
    formData.append('cartola', this.selectedFile);

    this.isUploading = true;
    this.movementService.uploadCartola(formData).subscribe({
      next: () => {
        this.dialogRef.close(true);
      },
      error: (err) => {
        this.uploadError = err.error?.message || 'Error al cargar cartola';
        this.isUploading = false;
      }
    });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}