import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
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
  PaginationNumberFormatterParams,
  RowApiModule
} from 'ag-grid-community';
import { AddCashComponent } from './add-cash/add-cash.component';
import { UploadStatementComponent } from './upload-statement/upload-statement.component';
import { EditMovementDialogComponent } from './edit-movement-dialog/edit-movement-dialog.component';
import { ActionCellRendererComponent } from './action-cell-renderer/action-cell-renderer.component';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';
import { FeatureControlDirective } from '../../shared/directives/feature-control.directive';
import { CardService } from '../../services/card.service';
import { Card } from '../../models/card.model';
import { Observable, of, Subject, lastValueFrom } from 'rxjs';
import { map, takeUntil, first } from 'rxjs/operators';
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
  RowApiModule,
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
    MatTooltipModule,
    MatButtonModule,
    FeatureControlDirective
  ]
})
export class MovementsComponent implements OnInit, OnDestroy {
  // 🔒 Subject para manejar suscripciones
  private destroy$ = new Subject<void>();
  private lastRefreshTime = 0;
  private readonly REFRESH_DEBOUNCE_TIME = 500; // ms
  
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
  private cardGridInitialized = false;
  private cashGridInitialized = false;
  public isRefreshing = false;

  constructor(
    private movementService: MovementService,
    private cardService: CardService,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef,
    private snackBar: MatSnackBar,
    private planLimitsService: PlanLimitsService
  ) {
    // 🔄 Usar observables directos de los servicios (como en cards)
    this.historyCard$ = this.movementService.cardMovements$;
    this.historyCash$ = this.movementService.cashMovements$;
    this.cards$ = this.cardService.cards$;

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
    // 🔄 Cargar datos iniciales usando el sistema reactivo
    this.movementService.getCardMovements().subscribe();
    this.movementService.getCashMovements().subscribe();
    this.cardService.getCards().subscribe();
    
    // Agregar listener para el resize
    window.addEventListener('resize', this.onWindowResize.bind(this));
  }

  ngOnDestroy() {
    console.log('🔄 [Movements] Destruyendo componente');
    // 🔒 Limpiar suscripciones
    this.destroy$.next();
    this.destroy$.complete();
    
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
    }
  }

  onNextPageCard() {
    if (this.gridApiCard) {
      this.gridApiCard.paginationGoToNextPage();
    }
  }

  onPrevPageCash() {
    if (this.gridApiCash) {
      this.gridApiCash.paginationGoToPreviousPage();
    }
  }

  onNextPageCash() {
    if (this.gridApiCash) {
      this.gridApiCash.paginationGoToNextPage();
    }
  }

  onGridReady(params: GridReadyEvent, isCardGrid: boolean = true) {
    if (isCardGrid) {
      this.gridApiCard = params.api;
      this.updatePaginationStateCard();
    } else {
      this.gridApiCash = params.api;
      this.updatePaginationStateCash();
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

    // Grid ready, data will be loaded automatically
  }

  onFirstDataRendered(params: any, isCardGrid: boolean = true) {
    if (isCardGrid && !this.cardGridInitialized) {
      this.cardGridInitialized = true;
      this.updatePaginationStateCard();
    } else if (!isCardGrid && !this.cashGridInitialized) {
      this.cashGridInitialized = true;
      this.updatePaginationStateCash();
    }
    params.api.sizeColumnsToFit();
  }

  onPaginationChanged(params: any, isCardGrid: boolean = true) {
    // Solo actualizar si las grids ya están inicializadas
    if (isCardGrid && this.cardGridInitialized) {
      this.updatePaginationStateCard();
      // Forzar refresco de la grid para asegurar renderizado correcto
      setTimeout(() => {
        if (this.gridApiCard) {
          this.gridApiCard.redrawRows();
        }
      }, 50);
    } else if (!isCardGrid && this.cashGridInitialized) {
      this.updatePaginationStateCash();
      // Forzar refresco de la grid para asegurar renderizado correcto
      setTimeout(() => {
        if (this.gridApiCash) {
          this.gridApiCash.redrawRows();
        }
      }, 50);
    }
  }

  // 🔄 Método para refrescar datos (usando la misma lógica que cards)
  refreshData(): void {
    const currentTime = Date.now();
    console.log('🔄 [Movements] Actualizando datos...');
    
    // Evitar spam de actualizaciones
    if (currentTime - this.lastRefreshTime < this.REFRESH_DEBOUNCE_TIME) {
      console.log('⏰ [Movements] Actualización ignorada por debounce');
      return;
    }
    
    this.lastRefreshTime = currentTime;
    this.isRefreshing = true;
    
    // Mostrar feedback al usuario
    this.snackBar.open('Actualizando movimientos...', 'Cerrar', { duration: 2000 });
    
    this.forceRefreshData();
  }

  // 🔄 Método para forzar actualización de datos (similar a cards)
  private async forceRefreshData(): Promise<void> {
    try {
      console.log('🔄 [Movements] Forzando actualización de datos...');
      
      // Forzar actualización de datos directamente
      await Promise.all([
        lastValueFrom(this.movementService.refreshCardMovements()),
        lastValueFrom(this.movementService.refreshCashMovements()),
        lastValueFrom(this.cardService.getCards())
      ]);
      
      console.log('✅ [Movements] Todos los datos actualizados exitosamente');
      this.snackBar.open('Movimientos actualizados', 'Cerrar', { duration: 2000 });
      
    } catch (error) {
      console.error('❌ [Movements] Error al forzar actualización:', error);
      this.snackBar.open('Error al actualizar movimientos', 'Cerrar', { duration: 3000 });
    } finally {
      this.isRefreshing = false;
      this.cdr.markForCheck();
    }
  }

  openAddMovementDialog() {
    const dialogRef = this.dialog.open(AddMovementComponent);
    dialogRef.afterClosed().pipe(
      takeUntil(this.destroy$)
    ).subscribe(result => {
      if (result) {
        console.log('🔄 [Movements] Movimiento agregado - refrescando datos');
        this.refreshData();
        this.planLimitsService.refreshUsage();
      }
    });
  }

  openAddCashMovementDialog() {
    const dialogRef = this.dialog.open(AddCashComponent, {
      data: { isCash: true }
    });
    dialogRef.afterClosed().pipe(
      takeUntil(this.destroy$)
    ).subscribe(result => {
      if (result) {
        console.log('🔄 [Movements] Movimiento en efectivo agregado - refrescando datos');
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
    
      dialogRef.afterClosed().pipe(
        takeUntil(this.destroy$)
      ).subscribe(result => {
        if (result === true) {
          console.log('🔄 [Movements] Tarjeta agregada - refrescando datos');
          this.refreshData();
        }
      });
    });
  }

  openUploadStatementDialog(): void {
    const dialogRef = this.dialog.open(UploadStatementComponent, {
      width: '500px'
    });
  
    dialogRef.afterClosed().pipe(
      takeUntil(this.destroy$)
    ).subscribe(result => {
      if (result === true) {
        console.log('🔄 [Movements] Cartola procesada - refrescando datos');
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
      cellStyle: {
        fontSize: 'var(--font-size-xs)',
        fontFamily: 'var(--font-family-normal)',
        color: 'var(--color-text)',
        whiteSpace: 'normal',
        lineHeight: '1.5'
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
        textAlign: 'right'
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
        textAlign: 'center'
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
      width: 120,
      minWidth: 120,
      maxWidth: 120,
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
      cellStyle: {
        fontSize: 'var(--font-size-xs)',
        fontFamily: 'var(--font-family-normal)',
        color: 'var(--color-text)',
        whiteSpace: 'normal',
        lineHeight: '1.5'
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
        textAlign: 'right'
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
        return `<div title="${category}" style="text-align: center;">${icon}</div>`;
      },
      cellStyle: {
        fontSize: 'var(--font-size-sm)',
        textAlign: 'center'
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
      width: 120,
      minWidth: 120,
      maxWidth: 120,
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
      color: 'var(--color-text)'
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
    rowHeight: 50,
    headerHeight: 50,
    rowHoverColor: 'var(--clr-surface-a20)',
    selectedRowBackgroundColor: 'var(--clr-primary-50)',
  });

  private updatePaginationStateCard() {
    if (this.gridApiCard) {
      try {
        const currentPage = this.gridApiCard.paginationGetCurrentPage();
        const totalPages = this.gridApiCard.paginationGetTotalPages();
        const totalRows = this.gridApiCard.paginationGetRowCount();
        
        if (totalPages > 0) {
          const newCurrentPage = currentPage + 1;
          
          // Solo actualizar si la página actual realmente cambió
          if (this.paginationStateCard.currentPage !== newCurrentPage) {
            this.paginationStateCard = {
              isFirstPage: currentPage === 0,
              isLastPage: currentPage >= totalPages - 1,
              currentPage: newCurrentPage,
              totalPages
            };
            
            this.cdr.detectChanges();
          }
        }
      } catch (error) {
        // Error updating pagination state
      }
    }
  }

  private updatePaginationStateCash() {
    if (this.gridApiCash) {
      try {
        const currentPage = this.gridApiCash.paginationGetCurrentPage();
        const totalPages = this.gridApiCash.paginationGetTotalPages();
        const totalRows = this.gridApiCash.paginationGetRowCount();
        
        if (totalPages > 0) {
          const newCurrentPage = currentPage + 1;
          
          // Solo actualizar si la página actual realmente cambió
          if (this.paginationStateCash.currentPage !== newCurrentPage) {
            this.paginationStateCash = {
              isFirstPage: currentPage === 0,
              isLastPage: currentPage >= totalPages - 1,
              currentPage: newCurrentPage,
              totalPages
            };
            
            this.cdr.detectChanges();
          }
        }
      } catch (error) {
        // Error updating pagination state
      }
    }
  }

  onEditMovement(movement: Movement): void {
    const dialogRef = this.dialog.open(EditMovementDialogComponent, {
      width: '500px',
      data: { movement: movement } // Envolver en objeto como espera el diálogo
    });

    dialogRef.afterClosed().pipe(
      takeUntil(this.destroy$)
    ).subscribe(result => {
      if (result) {
        console.log('🔄 [Movements] Movimiento editado - refrescando datos');
        this.refreshData();
        // Refrescar límites después de editar un movimiento
        this.planLimitsService.refreshUsage();
      }
    });
  }

  onDeleteMovement(movement: Movement): void {
    this.movementService.deleteMovement(movement.id).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: () => {
        console.log('🔄 [Movements] Movimiento eliminado - refrescando datos');
        this.refreshData();
        this.snackBar.open('Movimiento eliminado correctamente', 'Cerrar', {
          duration: 3000
        });
        this.planLimitsService.refreshUsage();
      },
      error: (error) => {
        console.error('❌ [Movements] Error al eliminar movimiento:', error);
        this.snackBar.open('Error al eliminar el movimiento', 'Cerrar', {
          duration: 3000
        });
      }
    });
  }
}
