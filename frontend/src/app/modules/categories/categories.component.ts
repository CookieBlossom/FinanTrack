import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { NgxChartsModule } from '@swimlane/ngx-charts';
import {
  AllCommunityModule,
  ClientSideRowModelApiModule,
  ClientSideRowModelModule,
  ColDef,
  ColGroupDef,
  ColumnApiModule,
  ColumnAutoSizeModule,
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
  AllCommunityModule,
]);
@Component({
  selector: 'app-categories',
  templateUrl: './categories.component.html',
  styleUrl: './categories.component.css',
  imports: [CommonModule, FormsModule, AgGridModule, NgxChartsModule],
})
export class CategoriesComponent {
  chartView: [number, number] = [400, 300];

  @HostListener('window:resize', ['$event'])
  onResize() {
    const width = window.innerWidth * 0.25; // o el porcentaje que ocupan tus gráficos
    const height = window.innerHeight * 0.35; // ajusta según necesidad
    this.chartView = [width, height];
  }

  ngOnInit() {
    this.onResize();
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

  columnDefs: ColDef[] = [
    { field: 'fecha' },
    { field: 'metodoPago' },
    { field: 'monto' },
    { field: 'categoria' },
    { field: 'nombre' },
  ];

  defaultColDef: ColDef = {
    filter: true,
    resizable: true,
  };

  rowData = [
    { fecha: '2024-04-01', metodoPago: 'Débito', monto: 15000, categoria: 'Alimentación', nombre: 'Supermercado' },
    { fecha: '2024-04-03', metodoPago: 'Efectivo', monto: 5000, categoria: 'Transporte', nombre: 'Taxi' },
  ];

  gastoTarjeta = [
    { name: 'Alimentación', value: 50000 },
    { name: 'Salud', value: 20000 },
  ];

  gastoEfectivo = [
    { name: 'Transporte', value: 30000 },
    { name: 'Entretenimiento', value: 15000 },
  ];

  onGridReady(params: GridReadyEvent) {
    params.api.sizeColumnsToFit();
  }

  onGridSizeChanged(params: GridSizeChangedEvent) {
    params.api.sizeColumnsToFit();
  }
}
