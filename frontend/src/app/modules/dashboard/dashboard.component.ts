import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxChartsModule, ScaleType } from '@swimlane/ngx-charts';
import { AgGridAngular, AgGridModule } from 'ag-grid-angular';
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
import { curveLinear } from 'd3-shape';
import { DashboardService, IncomeVsExpenses, CategoryExpense, RecentMovement } from '../../services/dashboard.service';
import { forkJoin, catchError, of, Subject } from 'rxjs';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { takeUntil, filter } from 'rxjs/operators';

ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  ColumnApiModule,
  ColumnAutoSizeModule,
  ClientSideRowModelApiModule,
  ValidationModule,
  PaginationModule
]);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    NgxChartsModule,
    AgGridModule,
    RouterModule
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Datos para los gráficos y tabla
  ingresosVsCostos: IncomeVsExpenses[] = [];
  gastosPorCategoria: CategoryExpense[] = [];
  rowData: RecentMovement[] = [];
  currentYear: number = new Date().getFullYear();

  // Flags para controlar la visibilidad
  showIngresosVsCostos = false;
  showGastosPorCategoria = false;
  showMovimientos = false;

  // Configuración de la vista del gráfico
  chartView: [number, number] = [800, 400];
  pieChartView: [number, number] = [400, 400];
  curve = curveLinear;

  // Configuración de colores
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

  colorScheme2 = {
    name: 'custom',
    selectable: true,
    group: ScaleType.Ordinal,
    domain: [
      '#4CAF50', // verde - Ingresos
      '#F44336'  // rojo - Costos
    ]
  };

  // Configuración de la tabla
  columnDefs: ColDef[] = [
    { 
      field: 'transactionDate',
      headerName: 'Fecha',
      valueFormatter: params => {
        return new Date(params.value).toLocaleDateString('es-CL');
      }
    },
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
    { 
      field: 'movementType',
      headerName: 'Tipo',
      valueFormatter: params => {
        return params.value === 'income' ? 'Ingreso' : 'Gasto';
      }
    },
    { field: 'category', headerName: 'Categoría' }
  ];

  // Tema de la tabla
  myTheme = themeQuartz.withParams({
    backgroundColor: 'var(--clr-surface-a10)',
    spacing: 10,
    accentColor: 'var(--color-primary-darker)',
    foregroundColor: 'var(--color-accent)',
    headerTextColor: 'var(--color-text-inverse)',
    headerBackgroundColor: 'var(--color-accent)',
    oddRowBackgroundColor: 'var(--clr-surface-a10)',
    headerColumnResizeHandleColor: 'var(--color-highlight)',
  });

  constructor(
    private dashboardService: DashboardService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    // Suscribirse a los eventos de navegación
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      takeUntil(this.destroy$)
    ).subscribe((event: NavigationEnd) => {
      // Solo limpiar si estamos saliendo del dashboard
      if (!event.url.includes('/dashboard')) {
        console.log('Saliendo del dashboard - Limpiando datos');
        this.clearData();
        this.cdr.detectChanges();
      }
    });
  }

  ngOnInit() {
    console.log('Inicializando dashboard');
    this.loadDashboardData();
  }

  ngOnDestroy() {
    console.log('Destruyendo dashboard - Limpieza final');
    this.clearData();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private clearData() {
    this.ingresosVsCostos = [];
    this.gastosPorCategoria = [];
    this.rowData = [];
    this.showIngresosVsCostos = false;
    this.showGastosPorCategoria = false;
    this.showMovimientos = false;
  }

  loadDashboardData() {
    console.log('Cargando datos del dashboard');
    // Limpiar datos existentes
    this.clearData();

    forkJoin({
      ingresos: this.dashboardService.getIncomeVsExpenses(this.currentYear).pipe(
        catchError((error) => {
          console.error('Error al obtener ingresos:', error);
          return of([]);
        })
      ),
      categorias: this.dashboardService.getCategoryExpenses().pipe(
        catchError((error) => {
          console.error('Error al obtener categorías:', error);
          return of([]);
        })
      ),
      movimientos: this.dashboardService.getRecentMovements(10).pipe(
        catchError((error) => {
          console.error('Error al obtener movimientos:', error);
          return of([]);
        })
      )
    }).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (data) => {
        console.log('Datos recibidos:', data);
        
        // Validar que los datos de ingresos vs costos sean válidos
        const ingresosValidos = data.ingresos?.length > 2 && 
          data.ingresos.every(item => 
            item.series?.length > 0 && 
            item.series.every(serie => serie.value !== undefined)
          );

        this.ingresosVsCostos = ingresosValidos ? data.ingresos : [];
        this.gastosPorCategoria = data.categorias;
        this.rowData = data.movimientos;

        // Mostrar los gráficos solo si hay datos válidos
        this.showIngresosVsCostos = ingresosValidos;
        this.showGastosPorCategoria = this.gastosPorCategoria.length > 0;
        this.showMovimientos = this.rowData.length > 0;
        
        console.log('Estado después de cargar datos:', {
          ingresosVsCostos: this.ingresosVsCostos,
          showIngresosVsCostos: this.showIngresosVsCostos,
          gastosPorCategoria: this.gastosPorCategoria,
          showGastosPorCategoria: this.showGastosPorCategoria,
          rowData: this.rowData,
          showMovimientos: this.showMovimientos
        });
      },
      error: (error) => {
        console.error('Error al cargar datos del dashboard:', error);
      }
    });
  }

  formatCurrency(params: any) {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(params.value);
  }

  onGridReady(params: any) {
    params.api.sizeColumnsToFit();
  }

  onGridSizeChanged(params: any) {
    params.api.sizeColumnsToFit();
  }

  formatTooltip(item: any): string {
    return `${item.name}: ${new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(item.value)}`;
  }
}