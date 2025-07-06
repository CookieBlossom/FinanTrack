import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxChartsModule, ScaleType, LegendPosition } from '@swimlane/ngx-charts';
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
  CellStyleModule,
  RowSelectionModule,
} from 'ag-grid-community';
import { curveLinear } from 'd3-shape';
import { DashboardService, IncomeVsExpenses, CategoryExpense, RecentMovement, TopExpense, FinancialSummary, FinancialCard } from '../../services/dashboard.service';
import { forkJoin, catchError, of, Subject } from 'rxjs';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { takeUntil, filter } from 'rxjs/operators';
import { ProjectedMovementService } from '../../services/projected-movement.service';
import { ProjectedMovement } from '../../models/projected-movement.model';

ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  ColumnApiModule,
  ColumnAutoSizeModule,
  ClientSideRowModelApiModule,
  ValidationModule,
  CellStyleModule,
  RowSelectionModule,
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
  rowData: ProjectedMovement[] = [];
  topExpenses: TopExpense[] = [];
  financialSummary: FinancialSummary | null = null;
  currentYear: number = new Date().getFullYear();

  // Flags para controlar la visibilidad
  showIngresosVsCostos = false;
  showGastosPorCategoria = false;
  showMovimientos = false;
  showTopExpenses = false;
  showFinancialSummary = false;

  // Configuración de la vista del gráfico
  chartView: [number, number] = [0, 0]; // Se calculará dinámicamente
  pieChartView: [number, number] = [0, 0]; // Se calculará dinámicamente
  curve = curveLinear;
  legendPosition: LegendPosition = LegendPosition.Right;
  
  // Configuración de colores
  colorScheme = {
    name: 'custom',
    selectable: true,
    group: ScaleType.Ordinal,
    domain: [
      'var(--color-primary)',      // #a84f68 - Rosa principal
      'var(--color-accent)',       // #9b2949 - Rosa acento
      'var(--color-highlight)',    // #e69ac3 - Rosa claro
      'var(--color-success)',      // #28a745 - Verde éxito
      'var(--color-warning)',      // #ffc107 - Amarillo advertencia
      'var(--color-info)',         // #17a2b8 - Azul info
      'var(--color-primary-dark)', // #6d2237 - Rosa oscuro
      'var(--color-primary-darker)' // #4f0f20 - Rosa más oscuro
    ]
  };

  colorScheme2 = {
    name: 'custom',
    selectable: true,
    group: ScaleType.Ordinal,
    domain: [
      'var(--color-success)', // Verde - Ingresos
      'var(--color-error)'    // Rojo - Gastos
    ]
  };

  // Configuración de la tabla para movimientos proyectados
  columnDefs: ColDef[] = [
    { 
      field: 'expectedDate',
      headerName: 'Fecha Esperada',
      valueFormatter: params => {
        return new Date(params.value).toLocaleDateString('es-CL');
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
      field: 'movementType',
      headerName: 'Tipo',
      valueFormatter: params => {
        return params.value === 'income' ? 'Ingreso' : 'Gasto';
      },
      cellStyle: {
        fontSize: 'var(--font-size-sm)',
        fontFamily: 'var(--font-family-normal)',
        color: 'var(--color-text)'
      }
    },
    { 
      field: 'status',
      headerName: 'Estado',
      valueFormatter: params => {
        switch(params.value) {
          case 'pending': return 'Pendiente';
          case 'completed': return 'Completado';
          case 'cancelled': return 'Cancelado';
          default: return params.value;
        }
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
      valueFormatter: params => {
        return `${params.value}%`;
      },
      cellStyle: {
        fontSize: 'var(--font-size-sm)',
        fontFamily: 'var(--font-family-normal)',
        color: 'var(--color-text)',
        fontWeight: '500'
      }
    }
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

  constructor(
    private dashboardService: DashboardService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private projectedMovementService: ProjectedMovementService
  ) {
    // Suscribirse a los eventos de navegación
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      takeUntil(this.destroy$)
    ).subscribe((event: NavigationEnd) => {
      // Recargar datos cuando navegamos al dashboard
      if (event.url.includes('/dashboard')) {
        console.log('Navegación al dashboard detectada, recargando datos...');
        this.loadDashboardData();
      }
    });
  }

  ngOnInit() {
    console.log('Inicializando componente Dashboard');
    this.calculateChartSizes();
    this.loadDashboardData();
    
    // Escuchar cambios de tamaño de ventana con debounce
    let resizeTimeout: any;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        this.calculateChartSizes();
      }, 250);
    });
  }

  ngOnDestroy() {
    console.log('Destruyendo componente Dashboard');
    window.removeEventListener('resize', () => {});
    this.destroy$.next();
    this.destroy$.complete();
  }

  private clearData() {
    console.log('Limpiando datos del dashboard');
    this.ingresosVsCostos = [];
    this.gastosPorCategoria = [];
    this.rowData = [];
    this.topExpenses = [];
    this.financialSummary = null;
    this.showIngresosVsCostos = false;
    this.showGastosPorCategoria = false;
    this.showMovimientos = false;
    this.showTopExpenses = false;
    this.showFinancialSummary = false;
    this.cdr.detectChanges();
  }

  loadDashboardData() {
    console.log('Iniciando carga de datos del dashboard');
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
      movimientos: this.projectedMovementService.getProjectedMovements().pipe(
        catchError((error) => {
          console.error('Error al obtener movimientos proyectados:', error);
          return of([]);
        })
      ),
      topExpenses: this.dashboardService.getTopExpenses().pipe(
        catchError((error) => {
          console.error('Error al obtener top expenses:', error);
          return of([]);
        })
      ),
      financialSummary: this.dashboardService.getFinancialSummary().pipe(
        catchError((error) => {
          console.error('Error al obtener resumen financiero:', error);
          return of(null);
        })
      )
    }).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (data) => {
        console.log('Datos recibidos del dashboard:', data);
        
        // Procesar ingresos vs costos
        this.ingresosVsCostos = this.validateAndCleanIncomeData(data.ingresos);
        console.log('Ingresos vs Costos procesados:', this.ingresosVsCostos);
        this.showIngresosVsCostos = this.ingresosVsCostos.length > 0;
        
        // Procesar gastos por categoría
        this.gastosPorCategoria = this.validateAndCleanCategoryData(data.categorias);
        console.log('Gastos por categoría procesados:', this.gastosPorCategoria);
        this.showGastosPorCategoria = this.gastosPorCategoria.length > 0;
        
        // Procesar movimientos proyectados
        this.rowData = data.movimientos;
        console.log('Movimientos proyectados procesados:', this.rowData);
        this.showMovimientos = this.rowData.length > 0;
        
        // Procesar top expenses
        this.topExpenses = data.topExpenses;
        console.log('Top expenses procesados:', this.topExpenses);
        this.showTopExpenses = this.topExpenses.length > 0;
        
        // Procesar resumen financiero
        this.financialSummary = data.financialSummary;
        console.log('Resumen financiero procesado:', this.financialSummary);
        this.showFinancialSummary = !!this.financialSummary;
        
        this.onDataChanged();
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error al cargar datos del dashboard:', error);
        this.cdr.detectChanges();
      }
    });
  }

  private validateAndCleanIncomeData(data: any[]): any[] {
    console.log('Validando datos de ingresos:', data);
    if (!Array.isArray(data)) return [];
    
    return data.map(item => {
      if (!item) return null;
      
      const series = Array.isArray(item.series) ? item.series.map((seriesItem: any) => {
        if (!seriesItem) return null;
        
        const value = Number(seriesItem.value);
        return {
          name: seriesItem.name || 'Sin nombre',
          value: isNaN(value) ? 0 : value
        };
      }).filter(Boolean) : [];

      return {
        name: item.name || 'Sin nombre',
        series: series
      };
    }).filter(Boolean);
  }

  private validateAndCleanCategoryData(data: any[]): any[] {
    console.log('Validando datos de categorías:', data);
    if (!Array.isArray(data)) return [];
    
    return data.map(item => {
      if (!item) return null;
      
      const value = Number(item.value);
      if (isNaN(value)) return null;
      
      let categoryName = (item.name || '').trim();
      if (!categoryName) categoryName = 'Sin categoría';
      
      return {
        name: categoryName,
        value: value
      };
    }).filter(Boolean);
  }

  private getVisibleSectionsCount(): number {
    let count = 0;
    if (this.showIngresosVsCostos) count++;
    if (this.showGastosPorCategoria) count++;
    if (this.showMovimientos) count++;
    if (this.showTopExpenses) count++;
    if (this.showFinancialSummary) count++;
    return count;
  }

  formatCurrency(params: any) {
    const value = Number(params.value);
    if (isNaN(value) || value === null || value === undefined) {
      return '$0';
    }
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  }

  formatAmount(value: number): string {
    if (isNaN(value) || value === null || value === undefined) {
      return '$0';
    }
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  }

  onGridReady(params: any) {
    params.api.sizeColumnsToFit();
  }

  onGridSizeChanged(params: any) {
    params.api.sizeColumnsToFit();
  }

  formatTooltip(item: any): string {
    // Validar que el item existe y tiene las propiedades necesarias
    if (!item) {
      return 'Sin información';
    }
    
    const name = item.name || item.data?.name || 'Sin nombre';
    const value = Number(item.value || item.data?.value || 0);
    
    if (isNaN(value) || value === null || value === undefined) {
      return `${name}: $0`;
    }
    
    const formattedValue = new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
    
    // Calcular el porcentaje del total solo si gastosPorCategoria está disponible
    if (this.gastosPorCategoria && Array.isArray(this.gastosPorCategoria) && this.gastosPorCategoria.length > 0) {
      const total = this.gastosPorCategoria.reduce((sum, cat) => sum + Number(cat.value), 0);
      const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
      return `${name}\n${formattedValue} (${percentage}%)`;
    }
    
    return `${name}: ${formattedValue}`;
  }

  formatLabel(value: any): string {
    // Si value es solo un string (nombre), devolver el nombre directamente
    if (typeof value === 'string') {
      return value;
    }
    
    // Si es un objeto con value, formatear como moneda
    if (value && value.value) {
      const numValue = Number(value.value);
      if (!isNaN(numValue) && numValue > 0) {
        const formattedValue = new Intl.NumberFormat('es-CL', {
          style: 'currency',
          currency: 'CLP',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        }).format(numValue);
        return formattedValue;
      }
    }
    
    return '';
  }

  onPieChartSelect(event: any): void {
    let categoryName = '';
    let categoryValue = 0;
    
    if (event && event.data) {
      categoryName = event.data.name || 'Sin nombre';
      categoryValue = Number(event.data.value) || 0;
    } else if (event && event.name) {
      categoryName = event.name;
      categoryValue = Number(event.value) || 0;
    } else {
      return;
    }
    if (categoryName && categoryName !== 'Sin nombre') {
    }
  }

  private calculateChartSizes() {
    setTimeout(() => {
      const lineChartContainer = document.querySelector('.ingresosVsCostos .chart-wrapper');
      if (lineChartContainer) {
        const rect = lineChartContainer.getBoundingClientRect();
        const containerWidth = rect.width;
        const containerHeight = rect.height;
        const width = Math.max(containerWidth - 120, 300); // 120px de padding total (20px + espacio para leyenda)
        const height = Math.max(containerHeight, 200); // 40px para título, etiquetas y padding
        this.chartView = [width, height];
      }

      const pieChartContainer = document.querySelector('.gastosPorCategoria .chart-container');
      if (pieChartContainer) {
        const rect = pieChartContainer.getBoundingClientRect();
        const containerWidth = rect.width;
        const containerHeight = rect.height;
        const width = Math.max(containerWidth - 60, 200); // 30px de margen a cada lado
        const height = Math.max(containerHeight - 60, 200); // 30px de margen arriba y abajo
        this.pieChartView = [width, height];
      }
      
      this.cdr.detectChanges();
    }, 300); // Aumentar el timeout para asegurar que los elementos estén completamente renderizados
  }
  private recalculateAfterDataLoad() {
    setTimeout(() => {
      this.calculateChartSizes();
    }, 200);
  }
  private onDataChanged() {
    this.cdr.detectChanges();
    this.recalculateAfterDataLoad();
  }
  get filteredCards(): FinancialCard[] {
    if (!this.financialSummary || !this.financialSummary.cards) {
      return [];
    }
    
    const allCards = this.financialSummary.cards;
    const nonCashCards = allCards.filter(card => 
      !card.name.toLowerCase().includes('efectivo')
    );
    
    if (nonCashCards.length > 0) {
      return nonCashCards
        .sort((a, b) => b.balance - a.balance)
        .slice(0, 1);
    }
    const cashCardsWithBalance = allCards.filter(card => 
      card.name.toLowerCase().includes('efectivo') && card.balance !== 0
    );
    
    if (cashCardsWithBalance.length > 0) {
      return cashCardsWithBalance
        .sort((a, b) => b.balance - a.balance)
        .slice(0, 1);
    }
    return [];
  }

  get hasClickableCards(): boolean {
    return this.filteredCards.length > 0;
  }
  getBalanceState(balance: number): 'positive' | 'negative' | 'neutral' {
    if (balance > 0) return 'positive';
    if (balance < 0) return 'negative';
    return 'neutral';
  }
  get totalBalanceState(): 'positive' | 'negative' | 'neutral' {
    if (!this.financialSummary) return 'neutral';
    return this.getBalanceState(this.financialSummary.totalBalance);
  }

  onCardClick(card: FinancialCard): void {
    this.router.navigate(['/cards'], { queryParams: { selectedCard: card.id } });
  }
}