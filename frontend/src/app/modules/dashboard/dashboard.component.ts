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
} from 'ag-grid-community';
import { curveLinear } from 'd3-shape';
import { DashboardService, IncomeVsExpenses, CategoryExpense, RecentMovement } from '../../services/dashboard.service';
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
  currentYear: number = new Date().getFullYear();

  // Flags para controlar la visibilidad
  showIngresosVsCostos = false;
  showGastosPorCategoria = false;
  showMovimientos = false;

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
      movimientos: this.projectedMovementService.getProjectedMovements().pipe(
        catchError((error) => {
          console.error('Error al obtener movimientos proyectados:', error);
          return of([]);
        })
      )
    }).subscribe({
      next: (data) => {
        console.log('Datos recibidos:', data);
        console.log('Datos de categorías crudos:', data.categorias);
        
        // Procesar ingresos vs costos - validar y limpiar datos
        this.ingresosVsCostos = this.validateAndCleanIncomeData(data.ingresos);
        console.log('Datos de ingresos vs costos procesados:', JSON.stringify(this.ingresosVsCostos, null, 2));
        // Verificar que hay datos válidos en las series
        this.showIngresosVsCostos = this.ingresosVsCostos.length > 0 && 
          this.ingresosVsCostos.some(item => item.series && item.series.length > 0 && 
            item.series.some(seriesItem => seriesItem.value > 0));
        
        // Procesar gastos por categoría - validar y limpiar datos
        this.gastosPorCategoria = this.validateAndCleanCategoryData(data.categorias);
        console.log('Datos de categorías procesados:', this.gastosPorCategoria);
        console.log('Datos que van al gráfico de pastel:', JSON.stringify(this.gastosPorCategoria, null, 2));
        // Verificar que hay categorías con valores positivos
        this.showGastosPorCategoria = this.gastosPorCategoria.length > 0 && 
          this.gastosPorCategoria.some(item => item.value > 0);
        
        // Procesar movimientos proyectados
        this.rowData = data.movimientos.filter((movement: ProjectedMovement) => 
          movement.status === 'pending' && movement.amount > 0
        );
        this.showMovimientos = this.rowData.length > 0;
        
        console.log('Estado final:', {
          showIngresosVsCostos: this.showIngresosVsCostos,
          showGastosPorCategoria: this.showGastosPorCategoria,
          showMovimientos: this.showMovimientos,
          movimientosCount: this.rowData.length,
          seccionesVisibles: this.getVisibleSectionsCount()
        });
        
        this.onDataChanged();
      },
      error: (error) => {
        console.error('Error al cargar datos del dashboard:', error);
        this.cdr.detectChanges();
      }
    });
  }

  private validateAndCleanIncomeData(data: any[]): any[] {
    if (!Array.isArray(data)) return [];
    
    return data.map(item => {
      if (!item || !item.series || !Array.isArray(item.series)) {
        return null;
      }
      
      const cleanSeries = item.series.map((seriesItem: any) => {
        const value = Number(seriesItem.value);
        return {
          name: seriesItem.name || 'Sin nombre',
          value: isNaN(value) ? 0 : value
        };
      }).filter((seriesItem: any) => seriesItem !== null);
      
      return {
        name: item.name || 'Sin nombre',
        series: cleanSeries
      };
    }).filter(item => item !== null);
  }

  private validateAndCleanCategoryData(data: any[]): any[] {
    if (!Array.isArray(data)) return [];
    
    return data.map(item => {
      if (!item || typeof item.name !== 'string') {
        return null;
      }
      
      const value = Number(item.value);
      if (isNaN(value) || value <= 0) {
        return null;
      }
      
      // Limpiar y validar el nombre de la categoría
      let categoryName = item.name.trim();
      
      // Evitar nombres problemáticos
      if (!categoryName || 
          categoryName.toLowerCase() === 'undefined' || 
          categoryName.toLowerCase() === 'null' ||
          categoryName.toLowerCase() === 'otra categoria' ||
          categoryName.toLowerCase() === 'otra categoría' ||
          categoryName.toLowerCase() === 'sin categoria' ||
          categoryName.toLowerCase() === 'sin categoría') {
        return null;
      }
      
      // Si el nombre está vacío o es muy corto, usar un nombre por defecto
      if (categoryName.length < 2) {
        categoryName = 'Sin nombre';
      }
      
      return {
        name: categoryName,
        value: value
      };
    }).filter(item => item !== null && item.value > 0); // Solo categorías con valores > 0
  }

  private getVisibleSectionsCount(): number {
    let count = 0;
    if (this.showIngresosVsCostos) count++;
    if (this.showGastosPorCategoria) count++;
    if (this.showMovimientos) count++;
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
    // Debug: ver qué datos llegan
    console.log('formatLabel recibió:', value);
    
    // Si value es solo un string (nombre), devolver el nombre directamente
    if (typeof value === 'string') {
      console.log('formatLabel devuelve (string):', value);
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
        console.log('formatLabel devuelve (objeto):', formattedValue);
        return formattedValue;
      }
    }
    
    console.log('formatLabel: valor no válido');
    return '';
  }

  onPieChartSelect(event: any): void {
    let categoryName = '';
    let categoryValue = 0;
    
    if (event && event.data) {
      // Formato: { data: { name: 'Alimentación', value: 20000 } }
      categoryName = event.data.name || 'Sin nombre';
      categoryValue = Number(event.data.value) || 0;
    } else if (event && event.name) {
      // Formato: { name: 'Alimentación', value: 20000 }
      categoryName = event.name;
      categoryValue = Number(event.value) || 0;
    } else {
      return;
    }
    if (categoryName && categoryName !== 'Sin nombre') {
      // Opcional: Mostrar un mensaje o navegar a detalles de la categoría
      console.log(`Mostrando detalles para la categoría: ${categoryName}`);
    }
  }

  private calculateChartSizes() {
    // Usar setTimeout para asegurar que los elementos estén renderizados
    setTimeout(() => {
      // Calcular tamaño para el gráfico de líneas (arriba, más espacio)
      const lineChartContainer = document.querySelector('.ingresosVsCostos .chart-wrapper');
      if (lineChartContainer) {
        const rect = lineChartContainer.getBoundingClientRect();
        const containerWidth = rect.width;
        const containerHeight = rect.height;
        const width = Math.max(containerWidth - 120, 300); // 120px de padding total (20px + espacio para leyenda)
        const height = Math.max(containerHeight, 200); // 40px para título, etiquetas y padding
        this.chartView = [width, height];
      }

      // Calcular tamaño para el gráfico de pastel (abajo, menos espacio)
      const pieChartContainer = document.querySelector('.gastosPorCategoria .chart-container');
      if (pieChartContainer) {
        const rect = pieChartContainer.getBoundingClientRect();
        const containerWidth = rect.width;
        const containerHeight = rect.height;
        // Usar un tamaño más pequeño para dejar espacio para las etiquetas
        const width = Math.max(containerWidth - 60, 200); // 30px de margen a cada lado
        const height = Math.max(containerHeight - 60, 200); // 30px de margen arriba y abajo
        this.pieChartView = [width, height];
        console.log('Tamaño del gráfico de pastel:', width, 'x', height);
      }
      
      this.cdr.detectChanges();
    }, 300); // Aumentar el timeout para asegurar que los elementos estén completamente renderizados
  }

  // Método para recalcular tamaños después de que los datos se carguen
  private recalculateAfterDataLoad() {
    setTimeout(() => {
      this.calculateChartSizes();
    }, 200);
  }

  // Método para manejar el cambio de datos y recalcular tamaños
  private onDataChanged() {
    this.cdr.detectChanges();
    this.recalculateAfterDataLoad();
  }
}