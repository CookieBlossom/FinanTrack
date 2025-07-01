import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
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
  RowSelectionModule,
  ModuleRegistry,
  themeQuartz,
  ValidationModule,
  PaginationModule,
  TextFilterModule,
  NumberFilterModule,
  DateFilterModule,
  CustomFilterModule,
  CellStyleModule
} from 'ag-grid-community';
import { AddCashComponent } from './add-cash/add-cash.component';
import { UploadStatementComponent } from './upload-statement/upload-statement.component';
import { MatIconModule } from '@angular/material/icon';
import { FeatureControlDirective } from '../../shared/directives/feature-control.directive';
import { CardService } from '../../services/card.service';
import { Card } from '../../models/card.model';
import { BehaviorSubject, Observable, combineLatest, of } from 'rxjs';
import { map, switchMap, tap, catchError } from 'rxjs/operators';

ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  ColumnApiModule,
  ColumnAutoSizeModule,
  ClientSideRowModelApiModule,
  ValidationModule,
  PaginationModule,
  RowSelectionModule,
  CellStyleModule,
  TextFilterModule,
  NumberFilterModule,
  DateFilterModule,
  CustomFilterModule
]);

@Component({
  selector: 'app-movements',
  templateUrl: './movements.component.html',
  styleUrls: ['./movements.component.css'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterModule,
    NgxChartsModule,
    AgGridModule,
    HttpClientModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatIconModule,
    FeatureControlDirective
  ]
})
export class MovementsComponent implements OnInit {
  // Observables reactivos para los datos
  private refreshTrigger$ = new BehaviorSubject<void>(undefined);
  
  historyCard$: Observable<Movement[]>;
  historyCash$: Observable<Movement[]>;
  cards$: Observable<Card[]>;
  
  // Propiedades computadas reactivas
  hasOnlyCashCards$: Observable<boolean>;
  hasNonCashCards$: Observable<boolean>;

  constructor(
    private movementService: MovementService,
    private cardService: CardService,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef
  ) {
    // Configurar observables reactivos con manejo de errores
    this.historyCard$ = this.refreshTrigger$.pipe(
      switchMap(() => this.movementService.getCardMovements().pipe(
        catchError(error => {
          console.error('Error al cargar movimientos de tarjetas:', error);
          return of([]);
        })
      ))
    );

    this.historyCash$ = this.refreshTrigger$.pipe(
      switchMap(() => this.movementService.getCashMovements().pipe(
        catchError(error => {
          console.error('Error al cargar movimientos en efectivo:', error);
          return of([]);
        })
      ))
    );

    this.cards$ = this.refreshTrigger$.pipe(
      switchMap(() => this.cardService.getCards().pipe(
        catchError(error => {
          console.error('Error al cargar tarjetas:', error);
          return of([]);
        })
      ))
    );

    // Computar propiedades reactivas
    this.hasOnlyCashCards$ = this.cards$.pipe(
      map(cards => {
        const nonCashCards = cards.filter(card => 
          card.statusAccount === 'active' && 
          card.nameAccount.toLowerCase() !== 'efectivo'
        );
        const cashCards = cards.filter(card => 
          card.statusAccount === 'active' && 
          card.nameAccount.toLowerCase() === 'efectivo'
        );
        return nonCashCards.length === 0 && cashCards.length > 0;
      })
    );

    this.hasNonCashCards$ = this.cards$.pipe(
      map(cards => {
        const nonCashCards = cards.filter(card => 
          card.statusAccount === 'active' && 
          card.nameAccount.toLowerCase() !== 'efectivo'
        );
        return nonCashCards.length > 0;
      })
    );
  }

  ngOnInit() {
    // El trigger inicial ya está configurado en el constructor
  }

  // Método para refrescar todos los datos
  refreshData(): void {
    this.refreshTrigger$.next();
    this.cdr.markForCheck();
  }

  openAddMovementDialog() {
    const dialogRef = this.dialog.open(AddMovementComponent);
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.refreshData();
      }
    });
  }

  openAddCashMovementDialog() {
    const dialogRef = this.dialog.open(AddCashComponent, {
      data: { isCash: true }
    });
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.refreshData();
      }
    });
  }

  openAddCardDialog(): void {
    // Importar dinámicamente el componente AddCardDialogComponent
    import('../card/add-card-dialog/add-card-dialog.component').then(({ AddCardDialogComponent }) => {
      const dialogRef = this.dialog.open(AddCardDialogComponent, {
        width: '600px',
        maxHeight: '90vh'
      });
    
      dialogRef.afterClosed().subscribe(result => {
        if (result === true) {
          this.refreshData();
        }
      });
    });
  }

  openUploadStatementDialog(): void {
    const dialogRef = this.dialog.open(UploadStatementComponent, {
      width: '500px'
    });
  
    dialogRef.afterClosed().subscribe(result => {
      if (result === true) {
        this.refreshData();
      }
    });
  }

  columnDefsCard: ColDef[] = [
    { 
      field: 'transactionDate', 
      headerName: 'Fecha',
      cellStyle: {
        fontSize: 'var(--font-size-sm)',
        fontFamily: 'var(--font-family-normal)',
        color: 'var(--color-text)'
      }
    },
    { 
      field: 'description', 
      headerName: 'Descripción',
      cellStyle: {
        fontSize: 'var(--font-size-sm)',
        fontFamily: 'var(--font-family-normal)',
        color: 'var(--color-text)'
      }
    },
    {
      field: 'amount',
      headerName: 'Monto',
      valueFormatter: params => {
        return new Intl.NumberFormat('es-CL', {
          style: 'currency',
          currency: 'CLP'
        }).format(params.value);
      },
      cellStyle: {
        fontSize: 'var(--font-size-sm)',
        fontFamily: 'var(--font-family-normal)',
        color: 'var(--color-text)',
        fontWeight: '500'
      }
    },
    { 
      field: 'category', 
      headerName: 'Categoría',
      valueGetter: params => {
        return params.data?.category?.nameCategory || 'Sin categoría';
      },
      cellStyle: {
        fontSize: 'var(--font-size-sm)',
        fontFamily: 'var(--font-family-normal)',
        color: 'var(--color-text)'
      }
    },
    { 
      field: 'card.nameAccount', 
      headerName: 'Método de Pago',
      cellStyle: {
        fontSize: 'var(--font-size-sm)',
        fontFamily: 'var(--font-family-normal)',
        color: 'var(--color-text)'
      }
    }
  ];

  columnDefsCash: ColDef[] = [
    { 
      field: 'transactionDate', 
      headerName: 'Fecha',
      cellStyle: {
        fontSize: 'var(--font-size-sm)',
        fontFamily: 'var(--font-family-normal)',
        color: 'var(--color-text)'
      }
    },
    { 
      field: 'description', 
      headerName: 'Descripción',
      cellStyle: {
        fontSize: 'var(--font-size-sm)',
        fontFamily: 'var(--font-family-normal)',
        color: 'var(--color-text)'
      }
    },
    {
      field: 'amount',
      headerName: 'Monto',
      valueFormatter: params => new Intl.NumberFormat('es-CL', {
        style: 'currency',
        currency: 'CLP'
      }).format(params.value),
      cellStyle: {
        fontSize: 'var(--font-size-sm)',
        fontFamily: 'var(--font-family-normal)',
        color: 'var(--color-text)',
        fontWeight: '500'
      }
    },
    { 
      field: 'category', 
      headerName: 'Categoría',
      valueGetter: params => {
        return params.data?.category?.nameCategory || 'Sin categoría';
      },
      cellStyle: {
        fontSize: 'var(--font-size-sm)',
        fontFamily: 'var(--font-family-normal)',
        color: 'var(--color-text)'
      }
    },
    { 
      field: 'card.nameAccount', 
      headerName: 'Tarjeta Asociada',
      cellStyle: {
        fontSize: 'var(--font-size-sm)',
        fontFamily: 'var(--font-family-normal)',
        color: 'var(--color-text)'
      }
    }
  ];

  defaultColDef: ColDef = {
    editable: false,
    filter: true,
    resizable: true,
    sortable: true,
    cellStyle: {
      fontSize: 'var(--font-size-sm)',
      fontFamily: 'var(--font-family-normal)',
      color: 'var(--color-text)'
    },
    headerClass: 'ag-header-cell-custom',
    cellClass: 'ag-cell-custom'
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
    // Configuración de fuentes usando variables CSS
    fontSize: 'var(--font-size-sm)',
    fontFamily: 'var(--font-family-normal)',
    // Configuración adicional para mejor legibilidad
    rowHeight: 60,
    headerHeight: 50,
    // Colores adicionales
    rowHoverColor: 'var(--clr-surface-a20)',
    selectedRowBackgroundColor: 'var(--clr-primary-50)',
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
