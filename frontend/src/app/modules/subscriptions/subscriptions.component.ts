import { Component, HostListener } from '@angular/core';
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
ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  ColumnApiModule,
  ColumnAutoSizeModule,
  ClientSideRowModelApiModule,
  ValidationModule
]);
@Component({
  selector: 'app-subscriptions',
  imports: [CommonModule, AgGridAngular, NgxChartsModule],
  templateUrl: './subscriptions.component.html',
  styleUrl: './subscriptions.component.css'
})
export class SubscriptionsComponent {
  view: [number, number] = [400, 400]; // tamaño inicial

  @HostListener('window:resize', ['$event'])
  onResize() {
    const width = window.innerWidth * 0.40;
    const height = window.innerHeight * 0.70;
    this.view = [width, height];
  }

  ngOnInit() {
    this.onResize(); // inicializa el tamaño
  }
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
  columnDefs: ColDef[] = [
    { field: 'fecha'},
    { field: 'metodo'},
    { field: 'nombre'},
    { field: 'monto'},
    { field: 'estado'},
    { field: 'frecuencia'},
  ];
  defaultColDef: ColDef = {
    editable: false,
    filter: true,
    resizable: true,
  };
  rowData = [
    { fecha: '2024-04-01', metodo: 'Debito', nombre: 'APPLE MUSIC', monto: -42000, estado: 'Activa', frecuencia: 'Mensual' },
    { fecha: '2024-04-01', metodo: 'Debito', nombre: 'APPLE MUSIC', monto: -42000, estado: 'Activa', frecuencia: 'Mensual' },
    { fecha: '2024-04-01', metodo: 'Debito', nombre: 'APPLE MUSIC', monto: -42000, estado: 'Activa', frecuencia: 'Mensual' },
    { fecha: '2024-04-01', metodo: 'Debito', nombre: 'APPLE MUSIC', monto: -42000, estado: 'Activa', frecuencia: 'Mensual' },
    { fecha: '2024-04-01', metodo: 'Debito', nombre: 'APPLE MUSIC', monto: -42000, estado: 'Activa', frecuencia: 'Mensual' },
    { fecha: '2024-04-01', metodo: 'Debito', nombre: 'APPLE MUSIC', monto: -42000, estado: 'Activa', frecuencia: 'Mensual' },
    { fecha: '2024-04-01', metodo: 'Debito', nombre: 'APPLE MUSIC', monto: -42000, estado: 'Activa', frecuencia: 'Mensual' },

  ];
  gastosPorCategoria = [
    { name: 'APPLE MUSIC', value: 150000 },
    { name: 'SPOTIFY', value: 75000 },
    { name: 'STEAMGAMES', value: 25000 },
    { name: 'Otros', value: 40000 },
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
}
