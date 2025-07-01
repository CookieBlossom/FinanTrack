import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild, OnInit, OnDestroy } from '@angular/core';
import { LegendPosition, NgxChartsModule, ScaleType } from '@swimlane/ngx-charts';
import { AgGridAngular, AgGridModule } from 'ag-grid-angular';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Subject, interval, takeUntil } from 'rxjs';
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
  PaginationModule,
  RowSelectionModule,
  themeQuartz,
  ValidationModule,
  ICellRendererParams,
  TextFilterModule,
  NumberFilterModule,
  DateFilterModule,
  CellStyleModule,
} from 'ag-grid-community';
import { AddUpcomingMovementComponent } from './add-upcoming-movement/add-upcoming-movement.component';
import { ProjectedMovementService } from '../../services/projected-movement.service';
import { MovementService } from '../../services/movement.service';
import { ProjectedMovement } from '../../models/projected-movement.model';
import { AuthTokenService } from '../../services/auth-token.service';
import { MovementCreate } from '../../models/movement.model';

ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  ColumnApiModule,
  ColumnAutoSizeModule,
  ClientSideRowModelApiModule,
  ValidationModule,
  PaginationModule,
  RowSelectionModule,
  TextFilterModule,
  NumberFilterModule,
  DateFilterModule,
  CellStyleModule,
]);

@Component({
  selector: 'app-upcoming-transactions',
  standalone: true,
  templateUrl: './upcoming-transactions.component.html',
  styleUrl: './upcoming-transactions.component.css',
  imports: [ 
    NgxChartsModule, 
    AgGridModule, 
    CommonModule, 
    MatDialogModule,
    MatButtonModule,
    MatIconModule
  ],
})
export class UpcomingTransactionsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private gridApi!: GridApi;
  
  // Datos de la tabla
  rowData: any[] = [];
  projectedMovements: ProjectedMovement[] = [];
  
  // Configuración de la tabla
  columnDefs: ColDef[] = [
    { 
      field: 'expectedDate', 
      headerName: 'Fecha Esperada',
      flex: 1,
      valueFormatter: params => {
        if (params.value) {
          return new Date(params.value).toLocaleDateString('es-CL');
        }
        return '';
      },
      cellStyle: params => {
        const baseStyle = {
          fontSize: 'var(--font-size-sm)',
          fontFamily: 'var(--font-family-normal)'
        };
        const today = new Date();
        const expectedDate = new Date(params.value);
        if (expectedDate < today) {
          return { ...baseStyle, color: '#d32f2f', fontWeight: 'bold' };
        }
        return baseStyle;
      }
    },
    { 
      field: 'cardName', 
      headerName: 'Método de Pago',
      flex: 1,
      valueGetter: params => {
        return params.data.card?.nameAccount || 'No especificado';
      },
      cellStyle: {
        fontSize: 'var(--font-size-sm)',
        fontFamily: 'var(--font-family-normal)',
        color: 'var(--color-text)'
      }
    },
    { 
      field: 'description', 
      headerName: 'Descripción',
      flex: 1.5,
      cellStyle: {
        fontSize: 'var(--font-size-sm)',
        fontFamily: 'var(--font-family-normal)',
        color: 'var(--color-text)'
      }
    },
    { 
      field: 'amount', 
      headerName: 'Monto',
      flex: 1,
      valueFormatter: params => {
        return new Intl.NumberFormat('es-CL', {
          style: 'currency',
          currency: 'CLP'
        }).format(params.value);
      },
      cellStyle: params => {
        const baseStyle = {
          fontSize: 'var(--font-size-sm)',
          fontFamily: 'var(--font-family-normal)',
          fontWeight: '500'
        };
        return params.data.movementType === 'expense' 
          ? { ...baseStyle, color: '#d32f2f' } 
          : { ...baseStyle, color: '#2e7d32' };
      }
    },
    { 
      field: 'categoryName', 
      headerName: 'Categoría',
      flex: 1,
      valueGetter: params => {
        return params.data.category?.nameCategory || 'Otros';
      },
      cellStyle: {
        fontSize: 'var(--font-size-sm)',
        fontFamily: 'var(--font-family-normal)',
        color: 'var(--color-text)'
      }
    },
    { 
      field: 'recurrenceType', 
      headerName: 'Frecuencia',
      flex: 1,
      valueFormatter: params => {
        if (!params.value) return 'Único';
        const types = {
          'weekly': 'Semanal',
          'monthly': 'Mensual',
          'yearly': 'Anual'
        };
        return types[params.value as keyof typeof types] || params.value;
      },
      cellStyle: {
        fontSize: 'var(--font-size-sm)',
        fontFamily: 'var(--font-family-normal)',
        color: 'var(--color-text)'
      }
    },
    { 
      field: 'probability', 
      headerName: 'Probabilidad',
      flex: 1,
      valueFormatter: params => {
        return `${params.value}%`;
      },
      cellStyle: params => {
        const baseStyle = {
          fontSize: 'var(--font-size-sm)',
          fontFamily: 'var(--font-family-normal)',
          fontWeight: '500'
        };
        const prob = params.value;
        if (prob >= 75) return { ...baseStyle, color: '#2e7d32' };
        if (prob >= 50) return { ...baseStyle, color: '#f57c00' };
        return { ...baseStyle, color: '#d32f2f' };
      }
    },
    { 
      field: 'status', 
      headerName: 'Estado',
      flex: 1,
      cellRenderer: (params: ICellRendererParams) => {
        const status = params.value;
        const statusConfig = {
          'pending': { text: 'Pendiente', class: 'status-pending' },
          'completed': { text: 'Completado', class: 'status-completed' },
          'cancelled': { text: 'Cancelado', class: 'status-cancelled' }
        };
        const config = statusConfig[status as keyof typeof statusConfig] || { text: status, class: '' };
        return `<span class="status-badge ${config.class}" style="font-size: var(--font-size-xs); font-family: var(--font-family-normal);">${config.text}</span>`;
      },
      cellStyle: {
        fontSize: 'var(--font-size-sm)',
        fontFamily: 'var(--font-family-normal)',
        color: 'var(--color-text)'
      }
    },
    {
      headerName: 'Acciones',
      flex: 1,
      cellRenderer: (params: ICellRendererParams) => {
        const isOverdue = new Date(params.data.expectedDate) < new Date();
        const isPending = params.data.status === 'pending';
        
        let buttons = '';
        
        if (isPending && isOverdue) {
          buttons += `<button class="action-btn complete-btn" style="font-size: var(--font-size-xs); font-family: var(--font-family-normal);" onclick="window.completeMovement(${params.data.id})">✓ Completar</button>`;
        }
        
        if (isPending) {
          buttons += `<button class="action-btn cancel-btn" style="font-size: var(--font-size-xs); font-family: var(--font-family-normal);" onclick="window.cancelMovement(${params.data.id})">✕ Cancelar</button>`;
        }
        
        return buttons || '-';
      },
      cellStyle: {
        fontSize: 'var(--font-size-sm)',
        fontFamily: 'var(--font-family-normal)',
        color: 'var(--color-text)'
      }
    }
  ];

  // Configuración del tema
  myTheme = themeQuartz.withParams({
    backgroundColor: 'var(--clr-surface-a10)',
    spacing: 10,
    accentColor: 'var(--color-primary-darker)',
    foregroundColor: 'var(--color-accent)',
    headerTextColor: 'var(--color-text-inverse)',
    headerBackgroundColor: 'var(--color-accent)',
    oddRowBackgroundColor: 'var(--clr-surface-a10)',
    headerColumnResizeHandleColor: 'var(--color-highlight)',
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

  // Variables para gráficos
  below = LegendPosition.Below;
  colorScheme = {
    name: 'custom',
    selectable: true,
    group: ScaleType.Ordinal,
    domain: [
      'var(--color-primary)',
      'var(--color-accent)',
      'var(--color-highlight)',
      'var(--color-primary-dark)',
      'var(--color-primary-darkest)',
    ]
  };

  // Estadísticas
  upcomingStats = {
    total: 0,
    overdue: 0,
    thisWeek: 0,
    thisMonth: 0,
    totalAmount: 0
  };

  constructor(
    private dialog: MatDialog,
    private projectedMovementService: ProjectedMovementService,
    private movementService: MovementService,
    private authTokenService: AuthTokenService,
    private snackBar: MatSnackBar
  ) {
    // Configurar funciones globales para los botones de acción
    (window as any).completeMovement = (id: number) => this.completeMovement(id);
    (window as any).cancelMovement = (id: number) => this.cancelMovement(id);
  }

  ngOnInit(): void {
    if (!this.authTokenService.hasToken()) {
      this.snackBar.open('No hay sesión activa', 'Cerrar', { duration: 3000 });
      return;
    }

    this.loadUpcomingMovements();
    
    // Verificar movimientos vencidos cada 5 minutos
    interval(5 * 60 * 1000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.checkOverdueMovements();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Cargar movimientos futuros
  loadUpcomingMovements(): void {
    this.projectedMovementService.getProjectedMovements().subscribe({
      next: (movements) => {
        this.projectedMovements = movements;
        this.processMovementsData();
        this.calculateStats();
        this.checkOverdueMovements();
      },
      error: (error) => {
        console.error('Error al cargar movimientos futuros:', error);
        this.snackBar.open('Error al cargar movimientos futuros', 'Cerrar', { duration: 3000 });
        // Asegurar que rowData esté vacío en caso de error
        this.rowData = [];
        this.projectedMovements = [];
        this.calculateStats();
      }
    });
  }

  // Procesar datos para la tabla
  private processMovementsData(): void {
    this.rowData = this.projectedMovements.map(movement => ({
      ...movement,
      expectedDate: new Date(movement.expectedDate),
      cardName: movement.card?.nameAccount || 'No especificado',
      categoryName: movement.category?.nameCategory || 'Otros'
    }));
  }

  // Calcular estadísticas
  private calculateStats(): void {
    const today = new Date();
    const thisWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    this.upcomingStats = this.projectedMovements.reduce((stats, movement) => {
      const movementDate = new Date(movement.expectedDate);
      const isPending = movement.status === 'pending';
      
      if (isPending) {
        stats.total++;
        
        if (movementDate < today) {
          stats.overdue++;
        }
        
        if (movementDate <= thisWeek) {
          stats.thisWeek++;
        }
        
        if (movementDate <= thisMonth) {
          stats.thisMonth++;
        }
        
        if (movement.movementType === 'expense') {
          stats.totalAmount += movement.amount;
        } else {
          stats.totalAmount -= movement.amount;
        }
      }
      
      return stats;
    }, {
      total: 0,
      overdue: 0,
      thisWeek: 0,
      thisMonth: 0,
      totalAmount: 0
    });
  }

  // Verificar movimientos vencidos
  private checkOverdueMovements(): void {
    const overdueMovements = this.projectedMovements.filter(movement => {
      const movementDate = new Date(movement.expectedDate);
      const today = new Date();
      return movement.status === 'pending' && movementDate < today;
    });

    if (overdueMovements.length > 0) {
      this.snackBar.open(
        `Tienes ${overdueMovements.length} movimiento(s) vencido(s) pendiente(s) de completar`,
        'Ver',
        { duration: 5000 }
      );
    }
  }

  // Completar movimiento (convertir a movimiento real)
  completeMovement(id: number): void {
    const movement = this.projectedMovements.find(m => m.id === id);
    if (!movement) return;

    const movementData: MovementCreate = {
      cardId: movement.cardId || 1, // Usar tarjeta por defecto si no se especificó
      categoryId: movement.categoryId,
      amount: movement.amount,
      description: movement.description || 'Movimiento proyectado completado',
      movementType: movement.movementType,
      movementSource: 'projected',
      transactionDate: new Date(),
      metadata: {
        projectedMovementId: movement.id,
        originalExpectedDate: movement.expectedDate,
        probability: movement.probability
      }
    };

    this.movementService.addMovement(movementData).subscribe({
      next: (newMovement) => {
        // Actualizar estado del movimiento proyectado
        this.projectedMovementService.updateProjectedMovement(id, {
          status: 'completed',
          actualMovementId: newMovement.id
        }).subscribe({
          next: () => {
            this.snackBar.open('Movimiento completado exitosamente', 'Cerrar', { duration: 3000 });
            this.loadUpcomingMovements();
          },
          error: (error) => {
            console.error('Error al actualizar movimiento proyectado:', error);
            this.snackBar.open('Error al actualizar estado', 'Cerrar', { duration: 3000 });
          }
        });
      },
      error: (error) => {
        console.error('Error al crear movimiento real:', error);
        this.snackBar.open('Error al completar movimiento', 'Cerrar', { duration: 3000 });
      }
    });
  }

  // Cancelar movimiento
  cancelMovement(id: number): void {
    this.projectedMovementService.updateProjectedMovement(id, {
      status: 'cancelled'
    }).subscribe({
      next: () => {
        this.snackBar.open('Movimiento cancelado exitosamente', 'Cerrar', { duration: 3000 });
        this.loadUpcomingMovements();
      },
      error: (error) => {
        console.error('Error al cancelar movimiento:', error);
        this.snackBar.open('Error al cancelar movimiento', 'Cerrar', { duration: 3000 });
      }
    });
  }

  // Abrir modal de agregar movimiento futuro
  openAddUpcomingMovement(): void {
    const dialogRef = this.dialog.open(AddUpcomingMovementComponent, {
      width: '100vw',
      height: '100vh',
      maxWidth: '100vw',
      maxHeight: '100vh',
      panelClass: 'full-screen-dialog',
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadUpcomingMovements();
      }
    });
  }

  // Eventos de la tabla
  onGridSizeChanged(params: GridSizeChangedEvent) {
    params.api.sizeColumnsToFit();
  }
  
  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    setTimeout(() => {
      params.api.sizeColumnsToFit();
      params.api.resetRowHeights();
    }, 0);
  }

  // Métodos para gráficos (mantener compatibilidad)
  @ViewChild('chartContainer') chartContainerRef!: ElementRef<HTMLDivElement>;
  chartView: [number, number] = [300, 300];

  ngAfterViewInit(): void {
    const observer = new ResizeObserver(entries => {
      for (let entry of entries) {
        const width = entry.contentRect.width;
        const height = entry.contentRect.height;
        this.chartView = [width, height * 0.7];
      }
    });

    if (this.chartContainerRef?.nativeElement) {
      observer.observe(this.chartContainerRef.nativeElement);
    }
  }
}
