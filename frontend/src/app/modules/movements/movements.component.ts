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
  CellStyleModule,
  TooltipModule,
  RowAutoHeightModule,
  ICellRendererParams,
  PaginationNumberFormatterParams
} from 'ag-grid-community';
import { AddCashComponent } from './add-cash/add-cash.component';
import { UploadStatementComponent } from './upload-statement/upload-statement.component';
import { EditMovementDialogComponent } from './edit-movement-dialog/edit-movement-dialog.component';
import { ActionCellRendererComponent } from './action-cell-renderer/action-cell-renderer.component';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FeatureControlDirective } from '../../shared/directives/feature-control.directive';
import { CardService } from '../../services/card.service';
import { Card } from '../../models/card.model';
import { BehaviorSubject, Observable, combineLatest, of } from 'rxjs';
import { map, switchMap, tap, catchError, take } from 'rxjs/operators';
import { PlanLimitsService } from '../../services/plan-limits.service';

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
  TooltipModule,
  RowAutoHeightModule,
  CustomFilterModule,
  PaginationModule,
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
    MatSnackBarModule,
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

  // Estados de paginación separados para cada tabla
  paginationStateCard = {
    isFirstPage: true,
    isLastPage: false,
    currentPage: 0,
    totalPages: 0
  };

  paginationStateCash = {
    isFirstPage: true,
    isLastPage: false,
    currentPage: 0,
    totalPages: 0
  };

  paginationPageSize = 10;

  private resizeTimeout: any;
  private gridApiCard: GridApi | null = null;
  private gridApiCash: GridApi | null = null;

  constructor(
    private movementService: MovementService,
    private cardService: CardService,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef,
    private snackBar: MatSnackBar,
    private planLimitsService: PlanLimitsService
  ) {
    // Configurar observables reactivos con manejo de errores y logging
    this.historyCard$ = this.refreshTrigger$.pipe(
      switchMap(() => this.movementService.getCardMovements().pipe(
        tap(movements => {
          console.log('Movimientos de tarjeta cargados:', movements);
          console.log('Categorías en movimientos:', movements.map(m => m.category));
        }),
        catchError(error => {
          console.error('Error al cargar movimientos de tarjetas:', error);
          return of([]);
        })
      ))
    );

    this.historyCash$ = this.refreshTrigger$.pipe(
      switchMap(() => this.movementService.getCashMovements().pipe(
        tap(movements => {
          console.log('Movimientos en efectivo cargados:', movements);
          console.log('Categorías en movimientos efectivo:', movements.map(m => m.category));
        }),
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
    // Agregar listener para el resize
    window.addEventListener('resize', this.onWindowResize.bind(this));
  }

  ngOnDestroy() {
    // Remover listener al destruir el componente
    window.removeEventListener('resize', this.onWindowResize.bind(this));
  }

  onWindowResize() {
    // Debounce para evitar muchas llamadas seguidas
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
    }
    this.resizeTimeout = setTimeout(() => {
      if (this.gridApiCard) {
        this.gridApiCard.sizeColumnsToFit();
      }
      if (this.gridApiCash) {
        this.gridApiCash.sizeColumnsToFit();
      }
    }, 200);
  }

  onPrevPageCard() {
    if (this.gridApiCard) {
      this.gridApiCard.paginationGoToPreviousPage();
      this.updatePaginationStateCard();
    }
  }

  onNextPageCard() {
    if (this.gridApiCard) {
      this.gridApiCard.paginationGoToNextPage();
      this.updatePaginationStateCard();
    }
  }

  onPrevPageCash() {
    if (this.gridApiCash) {
      this.gridApiCash.paginationGoToPreviousPage();
      this.updatePaginationStateCash();
    }
  }

  onNextPageCash() {
    if (this.gridApiCash) {
      this.gridApiCash.paginationGoToNextPage();
      this.updatePaginationStateCash();
    }
  }

  onGridReady(params: GridReadyEvent, isCardGrid: boolean = true) {
    if (isCardGrid) {
      this.gridApiCard = params.api;
      this.updatePaginationStateCard();
      console.log('Grid de tarjetas inicializada');
    } else {
      this.gridApiCash = params.api;
      this.updatePaginationStateCash();
      console.log('Grid de efectivo inicializada');
    }
    
    params.api.sizeColumnsToFit();
    
    // Observar cambios en el DOM que podrían afectar el tamaño
    const observer = new MutationObserver(() => {
      this.onWindowResize();
    });

    observer.observe(document.body, {
      attributes: true,
      childList: true,
      subtree: true
    });

    // Verificar datos después de que la grid esté lista
    if (isCardGrid) {
      this.historyCard$.pipe(take(1)).subscribe(data => {
        console.log('Datos en grid de tarjetas:', data);
        console.log('Número total de registros:', data.length);
        console.log('Páginas esperadas:', Math.ceil(data.length / this.paginationPageSize));
      });
    } else {
      this.historyCash$.pipe(take(1)).subscribe(data => {
        console.log('Datos en grid de efectivo:', data);
        console.log('Número total de registros:', data.length);
        console.log('Páginas esperadas:', Math.ceil(data.length / this.paginationPageSize));
      });
    }
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
        // Refrescar límites después de agregar un movimiento
        this.planLimitsService.refreshUsage();
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
        // Refrescar límites después de agregar un movimiento en efectivo
        this.planLimitsService.refreshUsage();
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
      valueFormatter: params => {
        if (!params.value) return '';
        const date = new Date(params.value);
        return date.toLocaleDateString('es-CL', {
          day: '2-digit',
          month: '2-digit',
          year: '2-digit'
        });
      },
      tooltipValueGetter: params => {
        if (!params.value) return '';
        const date = new Date(params.value);
        return date.toLocaleDateString('es-CL', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
      },
      cellStyle: {
        fontSize: 'var(--font-size-xs)',
        fontFamily: 'var(--font-family-normal)',
        color: 'var(--color-text)'
      },
      minWidth: 100,
      maxWidth: 100,
      wrapText: false,
      autoHeight: false,
      resizable: false
    },
    { 
      field: 'description', 
      headerName: 'Descripción',
      flex: 2,
      minWidth: 200,
      wrapText: true,
      autoHeight: true,
      cellStyle: {
        fontSize: 'var(--font-size-xs)',
        fontFamily: 'var(--font-family-normal)',
        color: 'var(--color-text)',
        whiteSpace: 'normal',
        lineHeight: '1.5',
        padding: '10px'
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
        fontWeight: '500',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        padding: '0 10px'
      },
      minWidth: 150,
      maxWidth: 150,
      type: 'numericColumn',
      filter: 'agNumberColumnFilter'
    },
    {
      field: 'movementSource',
      headerName: 'Origen',
      valueFormatter: params => {
        const sourceMap: { [key: string]: string } = {
          'manual': '✏️',
          'scraper': '🤖',
          'cartola': '📄',
          'subscription': '🔄',
          'projected': '📊'
        };
        return sourceMap[params.value] || params.value;
      },
      tooltipValueGetter: params => {
        const sourceMap: { [key: string]: string } = {
          'manual': 'Ingreso Manual',
          'scraper': 'Scraper Automático',
          'cartola': 'Cartola Bancaria',
          'subscription': 'Suscripción',
          'projected': 'Movimiento Proyectado'
        };
        return sourceMap[params.value] || params.value;
      },
      cellStyle: {
        fontSize: 'var(--font-size-sm)',
        textAlign: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      },
      minWidth: 100,
      maxWidth: 100,
      resizable: false
    },
    {
      field: 'actions',
      headerName: 'Acciones',
      cellRenderer: ActionCellRendererComponent,
      cellRendererParams: {
        onEdit: (data: Movement) => this.onEditMovement(data),
        onDelete: (data: Movement) => this.onDeleteMovement(data)
      },
      sortable: false,
      filter: false,
      width: 100,
      minWidth: 100,
      maxWidth: 100,
      pinned: 'right',
      resizable: false
    }
  ];

  columnDefsCash: ColDef[] = [
    { 
      field: 'transactionDate', 
      headerName: 'Fecha',
      valueFormatter: params => {
        if (!params.value) return '';
        const date = new Date(params.value);
        return date.toLocaleDateString('es-CL', {
          day: '2-digit',
          month: '2-digit',
          year: '2-digit'
        });
      },
      tooltipValueGetter: params => {
        if (!params.value) return '';
        const date = new Date(params.value);
        return date.toLocaleDateString('es-CL', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
      },
      cellStyle: {
        fontSize: 'var(--font-size-xs)',
        fontFamily: 'var(--font-family-normal)',
        color: 'var(--color-text)'
      },
      minWidth: 100,
      maxWidth: 100,
      wrapText: false,
      autoHeight: false,
      resizable: false
    },
    { 
      field: 'description', 
      headerName: 'Descripción',
      flex: 2,
      minWidth: 150,
      wrapText: true,
      autoHeight: true,
      cellStyle: {
        fontSize: 'var(--font-size-xs)',
        fontFamily: 'var(--font-family-normal)',
        color: 'var(--color-text)',
        whiteSpace: 'normal',
        lineHeight: '1.5',
        padding: '10px'
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
        fontWeight: '500',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        padding: '0 10px'
      },
      minWidth: 150,
      maxWidth: 150,
      type: 'numericColumn',
      filter: 'agNumberColumnFilter'
    },
    { 
      field: 'category', 
      headerName: 'Categoría',
      flex: 1,
      valueGetter: params => {
        return params.data?.category?.nameCategory || 'Sin categoría';
      },
      cellRenderer: (params: ICellRendererParams) => {
        const categoryIcons: { [key: string]: string } = {
          'Alimentacion': '🍽️',
          'Transporte': '🚗',
          'Entretenimiento': '🎮',
          'Compras': '🛍️',
          'Servicios': '📱',
          'Salud': '🏥',
          'Educacion': '📚',
          'Hogar': '🏠',
          'Otros': '📦'
        };
        const category = params.data?.category?.nameCategory || 'Otros';
        const icon = categoryIcons[category] || '📦';
        return `<div title="${category}" style="display: flex; align-items: center; justify-content: center;">${icon}</div>`;
      },
      cellStyle: {
        fontSize: 'var(--font-size-sm)',
        textAlign: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      },
      minWidth: 150,
      maxWidth: 150,
      resizable: false
    },
    {
      field: 'actions',
      headerName: 'Acciones',
      cellRenderer: ActionCellRendererComponent,
      cellRendererParams: {
        onEdit: (data: Movement) => this.onEditMovement(data),
        onDelete: (data: Movement) => this.onDeleteMovement(data)
      },
      sortable: false,
      filter: false,
      width: 100,
      minWidth: 100,
      maxWidth: 100,
      pinned: 'right',
      resizable: false
    }
  ];

  defaultColDef: ColDef = {
    editable: false,
    filter: true,
    resizable: true,
    sortable: true,
    suppressMovable: true,
    cellStyle: {
      fontSize: 'var(--font-size-xs)',
      fontFamily: 'var(--font-family-normal)',
      color: 'var(--color-text)',
      display: 'flex',
      alignItems: 'center'
    },
    headerClass: 'ag-header-cell-custom'
  };

  myTheme = themeQuartz.withParams({
    backgroundColor: 'var(--clr-surface-a10)',
    spacing: 10,
    accentColor: 'var(--color-text)',
    foregroundColor: 'var(--color-accent)',
    headerTextColor: 'var(--color-text)',
    headerBackgroundColor: 'var(--clr-surface-a20)',
    oddRowBackgroundColor: 'var(--clr-surface-a10)',
    headerColumnResizeHandleColor: 'var(--color-highlight)',
    textColor: 'var(--color-text)',
    fontSize: 'var(--font-size-xs)',
    fontFamily: 'var(--font-family-normal)',
    rowHeight: 'auto',
    headerHeight: 50,
    rowHoverColor: 'var(--clr-surface-a20)',
    selectedRowBackgroundColor: 'var(--clr-primary-50)',
  });

  private updatePaginationStateCard() {
    if (this.gridApiCard) {
      const currentPage = this.gridApiCard.paginationGetCurrentPage();
      const totalPages = this.gridApiCard.paginationGetTotalPages();
      const totalRows = this.gridApiCard.paginationGetRowCount();
      
      console.log('Estado de paginación tarjetas:', {
        currentPage,
        totalPages,
        totalRows,
        rowsPerPage: this.paginationPageSize
      });

      this.paginationStateCard = {
        isFirstPage: currentPage === 0,
        isLastPage: currentPage >= totalPages - 1,
        currentPage: currentPage + 1,
        totalPages
      };
      this.cdr.detectChanges();
    }
  }

  private updatePaginationStateCash() {
    if (this.gridApiCash) {
      const currentPage = this.gridApiCash.paginationGetCurrentPage();
      const totalPages = this.gridApiCash.paginationGetTotalPages();
      const totalRows = this.gridApiCash.paginationGetRowCount();
      
      console.log('Estado de paginación efectivo:', {
        currentPage,
        totalPages,
        totalRows,
        rowsPerPage: this.paginationPageSize
      });

      this.paginationStateCash = {
        isFirstPage: currentPage === 0,
        isLastPage: currentPage >= totalPages - 1,
        currentPage: currentPage + 1,
        totalPages
      };
      this.cdr.detectChanges();
    }
  }

  onEditMovement(movement: Movement): void {
    const dialogRef = this.dialog.open(EditMovementDialogComponent, {
      width: '600px',
      maxHeight: '90vh',
      data: { movement }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.refreshData();
        // Refrescar límites después de editar un movimiento
        this.planLimitsService.refreshUsage();
        this.snackBar.open('Movimiento actualizado correctamente', 'Cerrar', {
          duration: 3000,
          horizontalPosition: 'center',
          verticalPosition: 'top'
        });
      }
    });
  }

  onDeleteMovement(movement: Movement): void {
    let confirmMessage = `¿Estás seguro de que deseas eliminar el movimiento "${movement.description}"?`;
    
    // Agregar información adicional para movimientos manuales
    if (movement.movementSource === 'manual') {
      confirmMessage += '\n\nNota: Este es un movimiento manual. Al eliminarlo se liberará espacio en tu límite mensual de movimientos manuales.';
    }
    
    const confirmed = confirm(confirmMessage);
    
    if (confirmed) {
      this.movementService.deleteMovement(movement.id).subscribe({
        next: () => {
          this.refreshData();
          // Refrescar límites después de eliminar un movimiento manual
          if (movement.movementSource === 'manual') {
            this.planLimitsService.refreshUsage();
          }
          let successMessage = 'Movimiento eliminado correctamente';
          if (movement.movementSource === 'manual') {
            successMessage += '. Se ha liberado espacio en tu límite de movimientos manuales.';
          }
          this.snackBar.open(successMessage, 'Cerrar', {
            duration: 4000,
            horizontalPosition: 'center',
            verticalPosition: 'top'
          });
        },
        error: (error) => {
          console.error('Error al eliminar movimiento:', error);
          console.error('Detalles del error:', error.error);
          this.snackBar.open(
            error.error?.message || 'Error al eliminar el movimiento', 
            'Cerrar', 
            {
              duration: 5000,
              horizontalPosition: 'center',
              verticalPosition: 'top'
            }
          );
        }
      });
    } else {
      console.log('Usuario canceló la eliminación');
    }
  }
}
