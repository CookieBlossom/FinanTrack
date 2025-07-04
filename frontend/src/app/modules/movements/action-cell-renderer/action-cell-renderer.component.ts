import { Component } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-action-cell-renderer',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule
  ],
  template: `
    <div class="action-buttons">
      <button 
        mat-icon-button 
        color="primary" 
        matTooltip="Editar movimiento"
        (click)="onEdit()"
        class="action-button edit-button">
        <mat-icon>edit</mat-icon>
      </button>
      <button 
        mat-icon-button 
        color="warn" 
        matTooltip="Eliminar movimiento"
        (click)="onDelete()"
        class="action-button delete-button">
        <mat-icon>delete</mat-icon>
      </button>
    </div>
  `,
  styles: [`
    .action-buttons {
      display: flex;
      gap: 8px;
      align-items: center;
      justify-content: center;
      height: 100%;
      padding: 4px;
    }

    .action-button {
      width: 36px !important;
      height: 36px !important;
      line-height: 36px !important;
      padding: 6px !important;
      min-width: 36px !important;
      border-radius: 6px !important;
      /* Quitar animaciones molestas */
      transition: none !important;
      animation: none !important;
    }

    :host ::ng-deep .action-button mat-icon {
      font-size: 20px !important;
      width: 20px !important;
      height: 20px !important;
      line-height: 20px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
    }

    .edit-button {
      color: var(--color-accent, #007bff) !important;
      background-color: rgba(0, 123, 255, 0.1) !important;
    }

    .delete-button {
      color: var(--color-error, #f44336) !important;
      background-color: rgba(244, 67, 54, 0.1) !important;
    }

    .action-button:hover {
      transform: none !important;
      box-shadow: none !important;
      opacity: 0.8 !important;
    }

    .edit-button:hover {
      background-color: rgba(0, 123, 255, 0.2) !important;
    }

    .delete-button:hover {
      background-color: rgba(244, 67, 54, 0.2) !important;
    }

    /* Asegurar que los botones no se afecten por animaciones globales */
    .action-button * {
      transition: none !important;
      animation: none !important;
    }
  `]
})
export class ActionCellRendererComponent implements ICellRendererAngularComp {
  private params!: ICellRendererParams & {
    onEdit: (data: any) => void;
    onDelete: (data: any) => void;
  };

  agInit(params: ICellRendererParams & {
    onEdit: (data: any) => void;
    onDelete: (data: any) => void;
  }): void {
    this.params = params;
  }

  refresh(): boolean {
    return false;
  }

  onEdit(): void {
    if (this.params.onEdit) {
      this.params.onEdit(this.params.data);
    }
  }

  onDelete(): void {
    if (this.params.onDelete) {
      this.params.onDelete(this.params.data);
    }
  }
} 