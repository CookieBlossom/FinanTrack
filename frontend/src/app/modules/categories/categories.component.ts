import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { NgxChartsModule } from '@swimlane/ngx-charts';
import { CategoryService } from '../../services/category.service';
import { Category, CategoryExpense } from '../../models/category.model';
import { ColorPickerCellRendererComponent } from './color-picker-cell-editor.component.ts';
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
]);

@Component({
  selector: 'app-categories',
  templateUrl: './categories.component.html',
  styleUrls: ['./categories.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, NgxChartsModule, ColorPickerCellRendererComponent],
})
export class CategoriesComponent implements OnInit {
  chartView: [number, number] = [window.innerWidth * 0.35, window.innerHeight * 0.4];
  categories: Category[] = [];
  gridContext = { componentParent: this };
  gastoTarjeta: any[] = [];
  gastoEfectivo: any[] = [];

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
    { field: 'name_category', headerName: 'Categoría', flex: 1 },
    {
      field: 'icon',
      headerName: 'Icono',
      flex: 1,
      cellRenderer: (params: { value: any }) => {
        const iconName = params.value || 'more-horizontal';
        return `<img src="/assets/icons/${iconName}.svg" alt="${iconName}" width="24" height="24" style="vertical-align:middle;" />`;
      }
    },
    {
      field: 'color',
      headerName: 'Color',
      flex: 1,
      editable: false, // no editable porque ya es interactivo
      cellRenderer: ColorPickerCellRendererComponent,
      cellRendererParams: {},
    },
    {
      field: 'keywords',
      headerName: 'Palabras clave',
      flex: 2,
      editable: true,
      cellEditor: TagInputCellEditorComponent,
      cellRenderer: (params: { value: any }) => {
        if (Array.isArray(params.value) && params.value.length > 0) {
          return params.value
            .map((keyword: any) =>
              `<span style="display:inline-block;background:#f2f2f2;border-radius:8px;padding:2px 8px;margin-right:5px;font-size:12px;color:#555;">${typeof keyword === 'string' ? keyword : (keyword.value ?? '')}</span>`
            )
            .join('');
        } else {
          return '<span style="color:#aaa;font-style:italic;">Agrega keywords...</span>';
        }
      },
      valueParser: params => {
        if (Array.isArray(params.newValue)) {
          // Si el array contiene objetos, lo transforma a string.
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

  constructor(private categoryService: CategoryService) {}

  ngOnInit() {
    this.onResize();
    this.loadCategories();
  }

  loadCategories(): void {
    this.categoryService.getUserCategories().subscribe({
      next: (data: Category[]) => {
        this.categories = data.map(item => ({
          ...item,
          keywords: Array.isArray(item.keywords)
            ? item.keywords.map((k: any) => typeof k === 'string' ? k : (k.value ?? ''))
            : []
        }));
        
      },
      error: (err) => {
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
    params.api.sizeColumnsToFit();
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
      this.categoryService.updateUserCategoryKeywords(categoryId, newKeywords).subscribe({
        next: () => alert('Palabras clave actualizadas'),
        error: () => alert('Error al actualizar palabras clave')
      });
    }
    if (event.colDef.field === 'color') {
      const newColor = event.data.color;
      this.categoryService.updateCategoryColor(categoryId, newColor).subscribe({
        next: () => alert('Color actualizado'),
        error: () => alert('Error al actualizar color')
      });
    }
  }
}
