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
        class="action-button edit-button small-icon">
        <mat-icon class="small-icon">edit</mat-icon>
      </button>
      <button 
        mat-icon-button 
        color="warn" 
        matTooltip="Eliminar movimiento"
        (click)="onDelete()"
        class="action-button delete-button small-icon">
        <mat-icon class="small-icon">delete</mat-icon>
      </button>
    </div>
  `,
  styles: [`
    .action-buttons {
      display: flex;
      gap: 4px;
      align-items: center;
      justify-content: center;
      height: 100%;
    }

    .action-button {
      width: 24px !important;
      height: 24px !important;
      line-height: 24px !important;
      padding: 0 !important;
    }

    :host ::ng-deep .small-icon {
      font-size: 16px !important;
      width: 16px !important;
      height: 16px !important;
      line-height: 16px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
    }

    .edit-button {
      color: var(--color-accent, #007bff);
    }

    .delete-button {
      color: var(--color-error, #f44336);
    }

    .action-button:hover {
      background-color: var(--clr-surface-a10, rgba(0, 0, 0, 0.04));
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