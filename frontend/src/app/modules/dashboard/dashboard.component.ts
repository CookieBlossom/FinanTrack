import { Component, ElementRef, ViewChild } from '@angular/core';
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
} from 'ag-grid-community';
import { curveLinear } from 'd3-shape';
ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  ColumnApiModule,
  ColumnAutoSizeModule,
  ClientSideRowModelApiModule,
  ValidationModule
]);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    NgxChartsModule,
    AgGridModule
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent {
  @ViewChild('chartContainer') chartContainerRef!: ElementRef<HTMLDivElement>;

  chartView: [number, number] = [700, 300]; // ancho x alto inicial
  curve = curveLinear;
  ngAfterViewInit(): void {
    const observer = new ResizeObserver(entries => {
      for (let entry of entries) {
        const width = entry.contentRect.width;
        const height = entry.contentRect.height;
        this.chartView = [width, height];
      }
    });

    observer.observe(this.chartContainerRef.nativeElement);
  }
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

  ingresosVsCostos = [
    {
      name: 'Ingresos',
      series: [
        { name: 'Enero', value: 500000 },
        { name: 'Febrero', value: 620000 },
        { name: 'Marzo', value: 620000 },
        { name: 'Abril', value: 620000 },
        { name: 'Mayo', value: 620000 },
        { name: 'Junio', value: 620000 },
        { name: 'Julio', value: 620000 },
        { name: 'Agosto', value: 620000 },
        { name: 'Septiembre', value: 620000 },
        { name: 'Octubre', value: 620000 },
        { name: 'Noviembre', value: 620000 },
        { name: 'Diciembre', value: 620000 },
      ],
    },
    {
      name: 'Costos',
      series: [
        { name: 'Enero', value: 550000 },
        { name: 'Febrero', value: 626000 },
        { name: 'Marzo', value: 620200 },
        { name: 'Abril', value: 625000 },
        { name: 'Mayo', value: 620600 },
        { name: 'Junio', value: 620040 },
        { name: 'Julio', value: 600200 },
        { name: 'Agosto', value: 600000 },
        { name: 'Septiembre', value: 600000 },
        { name: 'Octubre', value: 630000 },
        { name: 'Noviembre', value: 610000 },
        { name: 'Diciembre', value: 700000 },
      ],
    },
  ];
  
  columnDefs: ColDef[] = [
    { field: 'fecha'},
    { field: 'descripcion'},
    { field: 'monto'},
  ];
  rowData = [
    { fecha: '2024-04-01', descripcion: 'Supermercado', monto: -42000 },
    { fecha: '2024-04-05', descripcion: 'Sueldo', monto: 850000 },
    { fecha: '2024-04-10', descripcion: 'Netflix', monto: -8500 },
    { fecha: '2024-04-10', descripcion: 'PedidosYa', monto: -8500 },
    { fecha: '2024-04-10', descripcion: 'MercadoLibre', monto: -8500 },
    { fecha: '2024-04-10', descripcion: 'PayPal', monto: -8500 },
    { fecha: '2024-04-10', descripcion: 'Luz', monto: -8500 },
    { fecha: '2024-04-10', descripcion: 'Agua', monto: -8500 },
    { fecha: '2024-04-10', descripcion: 'Lider', monto: -8500 },
    { fecha: '2024-04-10', descripcion: 'Santa Isabel', monto: -8500 },
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
  gastosPorCategoria = [
    { name: 'Alimentación', value: 150000 },
    { name: 'Transporte', value: 75000 },
    { name: 'Suscripciones', value: 25000 },
    { name: 'Otros', value: 40000 },
  ];
}
