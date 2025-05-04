import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-add-movement',
  standalone: true,
  templateUrl: './add-movement.component.html',
  styleUrls: ['./add-movement.component.css'],
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
})
export class AddMovementComponent {
  formData = {
    fecha: '',
    nombre: '',
    monto: 0,
    tipoMovimiento: '',
  };

  constructor(
    public dialogRef: MatDialogRef<AddMovementComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

  onSubmit() {
    this.dialogRef.close(this.formData);
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}