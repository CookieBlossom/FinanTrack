import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NgxChartsModule } from '@swimlane/ngx-charts';
import { AgGridModule } from 'ag-grid-angular';
import { HttpClientModule } from '@angular/common/http';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MovementService} from '../../services/movement.service';
import { Movement } from '../../models/movement.model';
import { AddMovementComponent } from './add-movement/add-movement.component';
import {
  ClientSideRowModelApiModule,
  ClientSideRowModelModule,
  ColDef,
  ColumnApiModule,
  ColumnAutoSizeModule,
  GridApi,
  GridReadyEvent,
  GridSizeChangedEvent,
  ModuleRegistry,
  themeQuartz,
  ValidationModule,
  PaginationModule,
} from 'ag-grid-community';
import { AddCashComponent } from './add-cash/add-cash.component';
import { UploadStatementComponent } from './upload-statement/upload-statement.component';
import { MatIconModule } from '@angular/material/icon';

ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  ColumnApiModule,
  ColumnAutoSizeModule,
  ClientSideRowModelApiModule,
  ValidationModule,
  PaginationModule,
]);
@Component({
  selector: 'app-movements',
  templateUrl: './movements.component.html',
  styleUrls: ['./movements.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    NgxChartsModule,
    AgGridModule,
    HttpClientModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatIconModule
  ]
})
export class MovementsComponent implements OnInit {
  historyCard: Movement[] = [];
  historyCash: Movement[] = [];

  constructor(
    private movementService: MovementService,
    private dialog: MatDialog
  ) {}

  ngOnInit() {
    this.loadMovements();
    this.movementService.getCashMovements().subscribe(
      movements => this.historyCash = movements,
      error => console.error('Error al cargar movimientos en efectivo:', error)
    );
  }

  loadMovements() {
    this.movementService.getMovements('cartola').subscribe(
      movements => {
        this.historyCard = movements;
      },
      error => {
        console.error('Error al cargar movimientos de cartola:', error);
      }
    );

    this.movementService.getMovements('manual').subscribe(
      movements => {
        this.historyCash = movements;
      },
      error => {
        console.error('Error al cargar movimientos manuales:', error);
      }
    );
  }

  openAddMovementDialog() {
    const dialogRef = this.dialog.open(AddMovementComponent);
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        if (result === true) {
          this.loadMovements();
        } else {
          this.movementService.addMovement({
            ...result,
            movementSource: 'manual'
          }).subscribe(
            newMovement => {
              this.historyCash.push(newMovement);
            },
            error => {
              console.error('Error al agregar movimiento:', error);
            }
          );
        }
      }
    });
  }
  openAddCashMovementDialog() {
    const dialogRef = this.dialog.open(AddCashComponent, {
      data: { isCash: true }
    });
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        if (result === true) {
          this.loadMovements();
        } else {
          this.movementService.addMovement({
            ...result,
            movementSource: 'manual',
          }).subscribe(
            newMovement => {
              this.historyCash.push(newMovement);
            },
            error => {
              console.error('Error al agregar movimiento en efectivo:', error);
            }
          );
        }
      }
    });
  }
  openUploadStatementDialog(): void {
    const dialogRef = this.dialog.open(UploadStatementComponent, {
      width: '500px'
    });
  
    dialogRef.afterClosed().subscribe(result => {
      if (result === true) {
        this.loadMovements(); // Recarga si se subió correctamente
      }
    });
  }
  columnDefsCard: ColDef[] = [
    { field: 'transactionDate', headerName: 'Fecha' },
    { field: 'description', headerName: 'Descripción' },
    {
      field: 'amount',
      headerName: 'Monto',
      valueFormatter: params => {
        return new Intl.NumberFormat('es-CL', {
          style: 'currency',
          currency: 'CLP'
        }).format(params.value);
      }
    },
    { field: 'category.name', headerName: 'Categoría' },
    { field: 'card.nameAccount', headerName: 'Método de Pago' }
  ];

  columnDefsCash: ColDef[] = [
    { field: 'transactionDate', headerName: 'Fecha' },
    { field: 'description', headerName: 'Método de Pago' }, // caja chica, banca, etc.
    {
      field: 'amount',
      headerName: 'Monto',
      valueFormatter: params => new Intl.NumberFormat('es-CL', {
        style: 'currency',
        currency: 'CLP'
      }).format(params.value)
    },
    { field: 'category.name', headerName: 'Categoría' },
    { field: 'card.nameAccount', headerName: 'Tarjeta Asociada' }
  ];

  defaultColDef: ColDef = {
    editable: false,
    filter: true,
    resizable: true,
    sortable: true
  };

  myTheme = themeQuartz.withParams({
    backgroundColor: 'var(--clr-surface-a10)',
    spacing: 10,
    accentColor: 'var(--color-text)',
    foregroundColor: 'var(--color-accent)',
    headerTextColor: 'var(--color-text-inverse)',
    headerBackgroundColor: 'var(--color-accent)',
    oddRowBackgroundColor: 'var(--clr-surface-a10)',
    headerColumnResizeHandleColor: 'var(--color-highlight)',
    textColor: 'var(--color-text)',
  });

  onGridSizeChanged(params: GridSizeChangedEvent) {
    params.api.sizeColumnsToFit();
  }

  onGridReady(params: GridReadyEvent) {
    setTimeout(() => {
      params.api.sizeColumnsToFit();
      params.api.resetRowHeights();
    }, 0);
  }
}
