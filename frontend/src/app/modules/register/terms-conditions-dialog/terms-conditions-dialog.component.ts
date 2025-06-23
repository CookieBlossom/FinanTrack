import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-terms-conditions-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './terms-conditions-dialog.component.html',
  styleUrls: ['./terms-conditions-dialog.component.css']
})
export class TermsConditionsDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<TermsConditionsDialogComponent>
  ) {}

  onAccept(): void {
    this.dialogRef.close(true);
  }

  onDecline(): void {
    this.dialogRef.close(false);
  }
} 