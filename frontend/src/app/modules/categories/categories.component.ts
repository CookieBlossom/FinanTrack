import { Component, OnInit, HostListener } from '@angular/core';
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
  ValueFormatterParams
} from 'ag-grid-community';
import { TagInputCellEditorComponent } from './tag-input-cell-editor.component';

ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  ColumnApiModule,
  ColumnAutoSizeModule,
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
export class CategoriesComponent implements OnInit {
  chartView: [number, number] = [window.innerWidth * 0.35, window.innerHeight * 0.4];
  categories: Category[] = [];
  gridContext = { componentParent: this };
  gridApi: any = null;
  gastoTarjeta: any[] = [];
  gastoEfectivo: any[] = [];

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
  });

  columnDefs: ColDef[] = [
    {
      field: 'name_category',
      headerName: 'Categoría',
      minWidth: 100,
      maxWidth: 150,
      flex: 1
    },
    {
      field: 'icon',
      headerName: 'Icono',
      minWidth: 90,
      maxWidth: 120,
      flex: 0.5,
      cellRenderer: (params: { value: any }) => {
        const iconName = params.value || 'more-horizontal';
        return `<img src="/assets/icons/${iconName}.svg" alt="${iconName}" width="24" height="24" style="vertical-align:middle;" />`;
      }
    },
    {
      field: 'color',
      headerName: 'Color',
      minWidth: 90,
      maxWidth: 120,
      flex: 0.5,
      editable: false,
      cellRenderer: ColorPickerCellRendererComponent,
      cellRendererParams: {},
    },
    {
      field: 'keywords',
      headerName: 'Palabras clave',
      minWidth: 180,
      flex: 3,
      editable: true,
      cellEditor: TagInputCellEditorComponent,
      cellRenderer: (params: { value: any }) => {
        if (Array.isArray(params.value) && params.value.length > 0) {
          return params.value
            .map((keyword: any) => {
              const keywordText = typeof keyword === 'string' ? keyword : (keyword.value ?? '');
              return `<span style="display: inline-flex; align-items: center; background: var(--color-primary); color: var(--color-text-inverse); padding: 3px 8px; border-radius: 10px; font-size: 0.7rem; font-weight: 500; margin: 1px 3px 1px 0; border: 1px solid var(--color-primary-darkest); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15); transition: all 0.2s ease;">${keywordText}</span>`;
            })
            .join('');
        } else {
          return '<span style="color: var(--color-text-muted); font-style: italic; font-size: 0.8rem;">Agrega palabras clave...</span>';
        }
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
    minWidth: 100
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
    private featureControlService: FeatureControlService
  ) {}

  ngOnInit() {
    console.log('Componente inicializado');
    this.onResize();
    
    // Cargar datos con un pequeño delay para asegurar que AG Grid esté listo
    setTimeout(() => {
      this.loadCategories();
    }, 100);
    
    this.loadPlanInfo();
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
    window.location.href = '/plans';
  }

  displayLimitNotification(data: LimitNotificationData): void {
    this.limitNotificationData = data;
    this.showLimitNotification = true;
  }

  hideLimitNotification(): void {
    this.showLimitNotification = false;
  }

  loadCategories(): void {
    console.log('Cargando categorías...');
    this.categoryService.getUserCategories().subscribe({
      next: (data: Category[]) => {
        console.log('Datos recibidos del backend:', data);
        this.categories = data.map(item => {
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
          console.log(`Categoría ${processedItem.name_category}:`, processedItem.keywords);
          return processedItem;
        });
        
        console.log('Categorías procesadas:', this.categories);
        
        // Calcular estadísticas después de cargar las categorías
        this.calculateStats();
        
        // Forzar actualización de AG Grid si está disponible
        setTimeout(() => {
          this.refreshTable();
        }, 200);
      },
      error: (err) => {
        console.error('Error al cargar categorías:', err);
        alert('Error al cargar categorías: ' + (err?.message || err));
      }
    });
  }
  onColorChanged(categoryId: number, newColor: string) {
    this.categoryService.updateCategoryColor(categoryId, newColor).subscribe({
      next: () => console.log('Color actualizado'),
      error: () => console.log('Error al actualizar color')
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

  // loadExpenses(): void {
  //   this.categoryService.getCategoryExpenses().subscribe({
  //     next: (data: CategoryExpense[]) => {
  //       // Actualizar datos de los gráficos
  //       this.gastoTarjeta = data
  //         .filter(expense => expense.payment_type === 'card')
  //         .map(expense => ({
  //           name: expense.name_category,
  //           value: expense.total_amount
  //         }));

  //       this.gastoEfectivo = data
  //         .filter(expense => expense.payment_type === 'cash')
  //         .map(expense => ({
  //           name: expense.name_category,
  //           value: expense.total_amount
  //         }));
  //     }
  //   });
  // }

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
    const categoryId = event.data.id;
    if (event.colDef.field === 'keywords') {
      const newKeywords = event.data.keywords;
      console.log('Keywords cambiadas:', { categoryId, newKeywords });
      
      // Verificar límite antes de guardar
      if (Array.isArray(newKeywords) && newKeywords.length > this.keywordsLimit) {
        this.displayLimitNotification({
          type: 'error',
          title: 'Límite de Keywords Alcanzado',
          message: `Has alcanzado el límite de ${this.keywordsLimit} keywords por categoría. Actualiza tu plan para agregar más keywords.`,
          limit: this.keywordsLimit,
          current: newKeywords.length,
          showUpgradeButton: true
        });
        
        // Revertir el cambio en la UI
        event.api.undoCellEditing();
        return;
      }
      
      this.categoryService.updateUserCategoryKeywords(categoryId, newKeywords).subscribe({
        next: (response) => {
          console.log('Respuesta del backend:', response);
          console.log('Palabras clave actualizadas correctamente');
          this.calculateStats();
          setTimeout(() => {
            this.loadCategories();
          }, 500); // Pequeño delay para asegurar que el backend procese
        },
        error: (error) => {
          console.error('Error al actualizar palabras clave:', error);
          
          // Mostrar más detalles del error
          let errorMessage = 'Error al actualizar palabras clave.';
          if (error.status === 500) {
            errorMessage = 'Error interno del servidor. Revisa la consola del backend para más detalles.';
          } else if (error.error && error.error.error) {
            errorMessage = error.error.error;
          }
          
          this.displayLimitNotification({
            type: 'error',
            title: 'Error al Actualizar',
            message: errorMessage,
            limit: this.keywordsLimit,
            current: newKeywords.length,
            showUpgradeButton: false
          });
          
          // Revertir el cambio en la UI en caso de error
          if (event.api && typeof event.api.undoCellEditing === 'function') {
            event.api.undoCellEditing();
          }
        }
      });
    }
    if (event.colDef.field === 'color') {
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

  // Método para forzar actualización de la tabla
  private refreshTable(): void {
    if (this.gridApi) {
      console.log('Forzando actualización de la tabla');
      this.gridApi.sizeColumnsToFit();
      
      // Forzar detección de cambios
      this.categories = [...this.categories];
    }
  }
}
