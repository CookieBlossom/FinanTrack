import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild } from '@angular/core';
import { LegendPosition, NgxChartsModule, ScaleType } from '@swimlane/ngx-charts';
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
  PaginationModule,
  RowSelectionModule,
  themeQuartz,
  ValidationModule,
} from 'ag-grid-community';
ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  ColumnApiModule,
  ColumnAutoSizeModule,
  ClientSideRowModelApiModule,
  ValidationModule,
  PaginationModule,
  RowSelectionModule,
  ValidationModule,
]);
@Component({
  selector: 'app-upcoming-transactions',
  standalone: true,
  templateUrl: './upcoming-transactions.component.html',
  styleUrl: './upcoming-transactions.component.css',
  imports: [ NgxChartsModule, AgGridModule, CommonModule ],
})
export class UpcomingTransactionsComponent {
  columnDefs: ColDef[] = [
    { field: 'fecha'},
    { field: 'metodo'},
    { field: 'nombre'},
    { field: 'monto'},
    { field: 'categoria'},
    { field: 'frecuencia'},
    { field: 'estado'},
  ];
  below = LegendPosition.Below;
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
  rowData = [
    { fecha: '2024-04-01', metodo: 'Tarjeta de crédito', nombre: 'Pago de luz', monto: 100000, categoria: 'Servicios', frecuencia: 'Mensual', estado: 'Pendiente' },
    { fecha: '2024-04-01', metodo: 'Tarjeta de debito', nombre: 'Supermercado', monto: 100000, categoria: 'Compras', frecuencia: 'Mensual', estado: 'Pendiente' },
    { fecha: '2024-04-01', metodo: 'Tarjeta de debito', nombre: 'Aliexpress', monto: 100000, categoria: 'Compras', frecuencia: 'Mensual', estado: 'Pendiente' },
    { fecha: '2024-04-01', metodo: 'Tarjeta de debito', nombre: 'Ropa', monto: 100000, categoria: 'Compras', frecuencia: 'Mensual', estado: 'Pendiente' },
    { fecha: '2024-04-01', metodo: 'Tarjeta de debito', nombre: 'PedidosYa', monto: 100000, categoria: 'Compras', frecuencia: 'Mensual', estado: 'Pendiente' },
    { fecha: '2024-04-01', metodo: 'Tarjeta de debito', nombre: 'Pago de celular', monto: 100000, categoria: 'Servicios', frecuencia: 'Mensual', estado: 'Pendiente' },
  ];
  onGridSizeChanged(params: GridSizeChangedEvent) {
    params.api.sizeColumnsToFit();
  }
  onGridReady(params: GridReadyEvent) {
    setTimeout(() => {
      params.api.sizeColumnsToFit();
      params.api.resetRowHeights();
    }, 0);
  }
  nextExpensesCols: ColDef[] = [
    { field: 'nombre', headerName: 'Nombre', flex: 1 },
    { field: 'fecha', headerName: 'Fecha', flex: 1 },
    {
      field: 'monto',
      headerName: 'Monto',
      flex: 1,
      valueFormatter: params => {
        return new Intl.NumberFormat('es-CL', {
          style: 'currency',
          currency: 'CLP'
        }).format(params.value);
      }
    },
    { field: 'categoria', headerName: 'Categoria', flex: 1 },
  ];
  
  nextExpenses = [
    { nombre: 'Netflix', fecha: '2024-05-10', monto: 8500, categoria: 'Entretenimiento' },
    { nombre: 'Spotify', fecha: '2024-05-11', monto: 5000, categoria: 'Entretenimiento' },
    { nombre: 'Luz', fecha: '2024-05-12', monto: 15000, categoria: 'Entretenimiento' },
  ];
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
  categoriasPorGasto = [
    { name: 'Servicios', value: 100000 },
    { name: 'Compras', value: 250000 },
    { name: 'Otros', value: 100000 },
  ];
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

  observer.observe(this.chartContainerRef.nativeElement);
}
}
