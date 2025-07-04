import { Component, OnInit, HostListener, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { NgxChartsModule } from '@swimlane/ngx-charts';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { CategoryService } from '../../services/category.service';
import { Category, CategoryExpense } from '../../models/category.model';
import { ColorPickerCellRendererComponent } from './color-picker-cell-editor.component.ts';
import { PlanLimitsService } from '../../services/plan-limits.service';
import { FeatureControlService } from '../../services/feature-control.service';
import { PLAN_LIMITS } from '../../models/plan.model';
import { LimitNotificationComponent, LimitNotificationData } from '../../shared/components/limit-notification/limit-notification.component';
import { PlanLimitAlertService } from '../../shared/services/plan-limit-alert.service';
import { Router } from '@angular/router';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  ColDef,
  GridReadyEvent,
  GridSizeChangedEvent,
  themeQuartz,
  ModuleRegistry,
  ClientSideRowModelModule,
  ICellRendererParams,
  ColumnApiModule,
  RowSelectionModule,
  ColumnAutoSizeModule,
  ClientSideRowModelApiModule,
  ValidationModule,
  PaginationModule,
  CustomEditorModule,
  TextFilterModule,
  TextEditorModule,
  NumberFilterModule,
  DateFilterModule,
  CustomFilterModule,
  RenderApiModule,
  UndoRedoEditModule,
  ValueFormatterFunc,
  ValueFormatterParams,
  CellStyleModule
} from 'ag-grid-community';
import { TagInputCellEditorComponent } from './tag-input-cell-editor.component';

ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  ColumnApiModule,
  ColumnAutoSizeModule,
  CellStyleModule,
  ClientSideRowModelApiModule,
  ValidationModule,
  RowSelectionModule,
  PaginationModule,
  CustomEditorModule,
  TextFilterModule,
  NumberFilterModule,
  DateFilterModule,
  TextEditorModule,
  CustomFilterModule,
  RenderApiModule,
  UndoRedoEditModule,
]);

@Component({
  selector: 'app-categories',
  templateUrl: './categories.component.html',
  styleUrls: ['./categories.component.css'],
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    AgGridModule, 
    NgxChartsModule, 
    MatIconModule, 
    MatButtonModule,
    LimitNotificationComponent
  ],
})
export class CategoriesComponent implements OnInit, OnDestroy {
  chartView: [number, number] = [window.innerWidth * 0.35, window.innerHeight * 0.4];
  
  // 🔄 Observables reactivos
  categories$: Observable<Category[]>;
  categoriesLoading$: Observable<boolean>;
  categories: Category[] = [];
  
  gridContext = { componentParent: this };
  gridApi: any = null;
  gastoTarjeta: any[] = [];
  gastoEfectivo: any[] = [];
  
  // Subscription management
  private destroy$ = new Subject<void>();

  // Variables para límites del plan
  keywordsLimit: number = 5;
  currentPlanName: string = 'free';

  // Variables para notificaciones
  showLimitNotification = false;
  limitNotificationData: LimitNotificationData = {
    type: 'warning',
    title: '',
    message: '',
    limit: 0,
    current: 0,
    showUpgradeButton: false
  };

  // Variables para el simulador
  testDescription: string = '';
  categorizationResult: any = null;
  showCharts: boolean = false;

  // Variables para estadísticas
  totalKeywords: number = 0;
  averageKeywordsPerCategory: number = 0;
  categoriesWithKeywords: number = 0;

  paginationPageSize = 10;
  paginationPageSizeSelector = [10, 25, 50, 100];

  myTheme = themeQuartz.withParams({
    backgroundColor: 'var(--clr-surface-a10)',
    spacing: 10,
    accentColor: 'var(--color-primary-darker)',
    foregroundColor: 'var(--color-accent)',
    headerTextColor: 'var(--color-text-inverse)',
    headerBackgroundColor: 'var(--color-accent)',
    oddRowBackgroundColor: 'var(--clr-surface-a10)',
    headerColumnResizeHandleColor: 'var(--color-highlight)',
    fontSize: 'var(--font-size-sm)',
    fontFamily: 'var(--font-family-normal)',
    rowHeight: 40,
    headerHeight: 40,
    rowHoverColor: 'var(--clr-surface-a20)',
    selectedRowBackgroundColor: 'var(--clr-primary-50)',
  });
  columnDefs: ColDef[] = [
    {
      field: 'name_category',
      headerName: 'Categoría',
      minWidth: 120,
      maxWidth: 180,
      flex: 1,
      cellStyle: {
        fontSize: 'var(--font-size-sm)',
        fontFamily: 'var(--font-family-normal)',
        fontWeight: '500',
        textAlign: 'center',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--color-text)'
      }
    },
    {
      field: 'name_category',
      headerName: 'Icono',
      minWidth: 100,
      maxWidth: 120,
      flex: 1,
      cellRenderer: (params: { value: any }) => {
        const iconMap: { [key: string]: string } = {
          'Alimentacion': '🍽️',
          'Transporte': '🚌',
          'Vivienda': '🏠',
          'Salud': '❤️',
          'Entretenimiento': '🎬',
          'Compras': '🛒',
          'Educacion': '🎓',
          'Servicios': '🔧',
          'Deportes': '⚽',
          'Viajes': '✈️',
          'Tecnologia': '💻',
          'Ropa': '👕',
          'Mascotas': '🐾',
          'Regalos': '🎁',
          'Impuestos': '📄',
          'Ahorros': '💰',
          'Inversiones': '📈',
          'Otros': '📋'
        };
        const icon = iconMap[params.value] || '📋';
        return `<div class="icon-emoji">${icon}</div>`;
      },
      cellStyle: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }
    },
    {
      field: 'color',
      headerName: 'Color',
      minWidth: 100,
      maxWidth: 120,
      flex: 1,
      editable: false,
      cellRenderer: ColorPickerCellRendererComponent,
      cellRendererParams: {},
      cellStyle: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }
    },
    {
      field: 'keywords',
      headerName: 'Palabras clave',
      minWidth: 150,
      flex: 2,
      editable: true,
      cellEditor: TagInputCellEditorComponent,
      cellRenderer: (params: { value: any }) => {
        if (Array.isArray(params.value) && params.value.length > 0) {
          return params.value
            .map((keyword: any) => {
              const keywordText = typeof keyword === 'string' ? keyword : (keyword.value ?? '');
              return `<span style="display: inline-flex; align-items: center; background: var(--color-primary); color: var(--color-text-inverse); padding: 4px 10px; border-radius: 12px; font-size: var(--font-size-xs); font-weight: 500; margin: 2px 4px 2px 0; border: 1px solid var(--color-primary-darkest); box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15); transition: all 0.2s ease; font-family: var(--font-family-normal);">${keywordText}</span>`;
            })
            .join('');
        } else {
          return `<span style="color: var(--color-text-muted); font-style: italic; font-size: var(--font-size-xs); font-family: var(--font-family-normal);">Agrega palabras clave...</span>`;
        }
      },
      cellStyle: {
        fontSize: 'var(--font-size-sm)',
        fontFamily: 'var(--font-family-normal)',
        padding: '8px 8px'
      },
      valueParser: params => {
        if (Array.isArray(params.newValue)) {
          return params.newValue.map((k: any) => typeof k === 'string' ? k : (k.value ?? ''));
        }
        if (typeof params.newValue === 'string')
          return params.newValue.split(',').map((s: string) => s.trim()).filter(Boolean);
        return [];
      }
    }
  ];

  defaultColDef: ColDef = {
    filter: true,
    resizable: true,
    minWidth: 100,
    cellStyle: {
      fontSize: 'var(--font-size-sm)',
      fontFamily: 'var(--font-family-normal)',
      color: 'var(--color-text)'
    },
    headerClass: 'ag-header-cell-custom',
    cellClass: 'ag-cell-custom'
  };

  @HostListener('window:resize', ['$event'])
  onResize() {
    const width = window.innerWidth * 0.35;
    const height = window.innerHeight * 0.4;
    this.chartView = [width, height];
  }

  constructor(
    private categoryService: CategoryService,
    private planLimitsService: PlanLimitsService,
    private featureControlService: FeatureControlService,
    private planLimitAlertService: PlanLimitAlertService,
    private router: Router
  ) {
    // 🔄 Inicializar observables reactivos
    this.categories$ = this.categoryService.categories$;
    this.categoriesLoading$ = this.categoryService.loading$;
  }

  ngOnInit() {
    // 🔄 Cargar datos usando el sistema reactivo
    this.loadReactiveData();
    this.loadPlanInfo();
    this.onResize();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadReactiveData(): void {
    // 🔄 Cargar categorías usando el sistema reactivo
    this.categoryService.getUserCategories().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (categories) => {
        console.log('✅ [CategoriesComponent] Categorías cargadas:', categories.length);
        
        // 📊 Actualizar array para templates y grid
        this.categories = categories.map(item => {
          const processedItem = {
            ...item,
            keywords: Array.isArray(item.keywords)
              ? item.keywords.map((k: any) => {
                  if (typeof k === 'string') {
                    return k.trim();
                  } else if (k && typeof k === 'object') {
                    return (k.display || k.value || '').trim();
                  }
                  return String(k).trim();
                }).filter(k => k.length > 0)
              : []
          };
          return processedItem;
        });
        
        this.updateGridData(this.categories);
        this.calculateStats();
      },
      error: (error) => {
        console.error('❌ Error al cargar categorías:', error);
      }
    });
  }

  private updateGridData(categories: Category[]): void {
    if (this.gridApi) {
      this.gridApi.setGridOption('rowData', categories);
      // Forzar redibujado después de un breve delay
      setTimeout(() => {
        this.gridApi.sizeColumnsToFit();
      }, 100);
    }
  }

  loadPlanInfo(): void {
    // Cargar información del plan actual
    this.featureControlService.featureControl$.subscribe(control => {
      if (control) {
        this.currentPlanName = control.planName;
      }
    });

    // Cargar límite de keywords
    this.planLimitsService.getLimitStatusInfo(PLAN_LIMITS.KEYWORDS_PER_CATEGORY).subscribe({
      next: (limitStatus) => {
        this.keywordsLimit = limitStatus.limit;
      },
      error: (error) => {
        console.error('Error al cargar límite de keywords:', error);
        this.keywordsLimit = 5; // Límite por defecto
      }
    });
  }

  upgradePlan(): void {
    this.router.navigate(['/plans']);
  }

  displayLimitNotification(data: LimitNotificationData): void {
    this.limitNotificationData = data;
    this.showLimitNotification = true;
  }

  hideLimitNotification(): void {
    this.showLimitNotification = false;
  }

  onColorChanged(categoryId: number, newColor: string) {
    // 🔄 El servicio actualiza automáticamente el cache
    this.categoryService.updateCategoryColor(categoryId, newColor).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: () => {
        console.log('✅ Color actualizado para categoría:', categoryId);
        // No necesitamos refrescar manualmente, el sistema reactivo lo hace automáticamente
      },
      error: (error) => {
        console.error('❌ Error al actualizar color:', error);
      }
    });
  }

  onCellClicked(event: any) {
    // Solo si la celda es 'keywords'
    if (event.colDef.field === 'keywords') {
      // Detectar si el click fue en el botón usando event.event.target
      const target = event.event.target as HTMLElement;
      if (target && target.classList.contains('btn-add-keyword')) {
        // Forzar edición
        event.api.startEditingCell({
          rowIndex: event.rowIndex,
          colKey: 'keywords'
        });
      }
    }
  }

  onGridReady(params: GridReadyEvent) {
    console.log('AG Grid listo');
    this.gridApi = params.api;
    params.api.sizeColumnsToFit();
    
    // Si ya tenemos datos, forzar un refresh
    if (this.categories.length > 0) {
      setTimeout(() => {
        params.api.sizeColumnsToFit();
        console.log('Tabla refrescada con datos existentes');
      }, 100);
    }
  }

  onGridSizeChanged(params: GridSizeChangedEvent) {
    params.api.sizeColumnsToFit();
  }

  formatTooltip = (data: any): string => {
    return `${data.name}: ${new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP'
    }).format(data.value)}`;
  }

  onCellValueChanged(event: any) {
    if (event.colDef.field === 'keywords') {
      const categoryId = event.data.id;
      const newKeywords = event.newValue || [];
      
      // Verificar límites antes de actualizar
      if (Array.isArray(newKeywords) && newKeywords.length > this.keywordsLimit) {
        this.planLimitAlertService.showKeywordLimitAlert(
          newKeywords.length,
          this.keywordsLimit
        ).subscribe({
          next: (result) => {
            if (result.action === 'upgrade') {
              this.router.navigate(['/plans']);
            } else if (result.action === 'dismiss') {
              // Revertir cambios
              event.data.keywords = event.oldValue;
              this.gridApi.redrawRows({ rowNodes: [event.node] });
            }
          }
        });
        return;
      }

      // 🔄 El servicio actualiza automáticamente el cache
      this.categoryService.updateUserCategoryKeywords(categoryId, newKeywords).pipe(
        takeUntil(this.destroy$)
      ).subscribe({
        next: () => {
          console.log('✅ Palabras clave actualizadas para categoría:', categoryId);
          this.calculateStats();
        },
        error: (error) => {
          console.error('❌ Error al actualizar palabras clave:', error);
          // Revertir cambios en caso de error
          event.data.keywords = event.oldValue;
          this.gridApi.redrawRows({ rowNodes: [event.node] });
        }
      });
    }
    if (event.colDef.field === 'color') {
      const categoryId = event.data.id;
      const newColor = event.data.color;
      this.categoryService.updateCategoryColor(categoryId, newColor).subscribe({
        next: () => console.log('Color actualizado'),
        error: () => alert('Error al actualizar color')
      });
    }
  }

  // Métodos para el simulador de categorización
  testCategorization(): void {
    if (!this.testDescription.trim()) {
      this.categorizationResult = null;
      return;
    }

    const description = this.testDescription.toUpperCase();
    let foundCategory = null;
    let matchedKeywords: string[] = [];

    // Buscar coincidencias en todas las categorías
    for (const category of this.categories) {
      if (category.keywords && Array.isArray(category.keywords)) {
        for (const keyword of category.keywords) {
          if (description.includes(keyword.toUpperCase())) {
            foundCategory = category;
            matchedKeywords.push(keyword);
          }
        }
      }
    }

    this.categorizationResult = {
      found: !!foundCategory,
      category: foundCategory,
      matchedKeywords: matchedKeywords
    };
  }

  // Métodos para estadísticas
  calculateStats(): void {
    console.log('Calculando estadísticas...');
    console.log('Categorías actuales:', this.categories);
    
    this.totalKeywords = 0;
    this.categoriesWithKeywords = 0;

    for (const category of this.categories) {
      console.log(`Categoría ${category.name_category}:`, category.keywords);
      if (category.keywords && Array.isArray(category.keywords)) {
        this.totalKeywords += category.keywords.length;
        if (category.keywords.length > 0) {
          this.categoriesWithKeywords++;
        }
      }
    }

    this.averageKeywordsPerCategory = this.categories.length > 0 
      ? this.totalKeywords / this.categories.length 
      : 0;
      
    console.log('Estadísticas calculadas:', {
      totalKeywords: this.totalKeywords,
      categoriesWithKeywords: this.categoriesWithKeywords,
      averageKeywordsPerCategory: this.averageKeywordsPerCategory
    });
  }

  // Métodos para acciones adicionales
  exportKeywords(): void {
    const exportData = this.categories.map(category => ({
      categoria: category.name_category,
      keywords: category.keywords ? category.keywords.join(', ') : ''
    }));

    const csvContent = 'data:text/csv;charset=utf-8,' 
      + 'Categoría,Keywords\n'
      + exportData.map(row => `${row.categoria},"${row.keywords}"`).join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'keywords_categorias.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  toggleCharts(): void {
    this.showCharts = !this.showCharts;
  }
}
