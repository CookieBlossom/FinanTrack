import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { NgxChartsModule } from '@swimlane/ngx-charts';
import { AgGridModule } from 'ag-grid-angular';
import {
  ClientSideRowModelApiModule,
  ClientSideRowModelModule,
  ColDef,
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
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';
import { ToolbarComponent } from '../../shared/components/toolbar/toolbar.component';

ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  ColumnApiModule,
  ColumnAutoSizeModule,
  ClientSideRowModelApiModule,
  ValidationModule,
  PaginationModule,
  RowSelectionModule,
]);

@Component({
  selector: 'app-movements',
  templateUrl: './movements.component.html',
  styleUrls: ['./movements.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    
    RouterModule,
    NgxChartsModule,
    AgGridModule,
    SidebarComponent,
    ToolbarComponent,
  ]
})
export class MovementsComponent {
  columnDefsCard: ColDef[] = [
    { field: 'fecha' },
    { field: 'nameCompany' },
    { field: 'monto' }
  ];

  columnDefsCash: ColDef[] = [
    { field: 'fecha' },
    { field: 'nombre' },
    { field: 'monto' },
    { field: 'tipoMovimiento' }
  ];

  historyCard = [
    { fecha: '2024-04-01', nameCompany: 'Supermercado', monto: -42000 },
    { fecha: '2024-04-05', nameCompany: 'Sueldo', monto: 850000 },
    { fecha: '2024-04-10', nameCompany: 'Netflix', monto: -8500 },
    { fecha: '2024-04-10', nameCompany: 'PedidosYa', monto: -8500 },
    { fecha: '2024-04-10', nameCompany: 'MercadoLibre', monto: -8500 },
    { fecha: '2024-04-10', nameCompany: 'PayPal', monto: -8500 },
    { fecha: '2024-04-10', nameCompany: 'Luz', monto: -8500 },
    { fecha: '2024-04-10', nameCompany: 'Agua', monto: -8500 },
    { fecha: '2024-04-10', nameCompany: 'Lider', monto: -8500 },
    { fecha: '2024-04-10', nameCompany: 'Santa Isabel', monto: -8500 }
  ];

  historyCash = [
    { fecha: '2024-04-01', nombre: 'Recibo de dinero', monto: 42000, tipoMovimiento: 'Vale vista' },
    { fecha: '2024-04-01', nombre: 'Recibo de dinero', monto: 42000, tipoMovimiento: 'Giro postal' },
    { fecha: '2024-04-01', nombre: 'Recibo de dinero', monto: 42000, tipoMovimiento: 'Pago en efectivo' },
    { fecha: '2024-04-01', nombre: 'Recibo de dinero', monto: 42000, tipoMovimiento: 'Pago en efectivo' },
    { fecha: '2024-04-01', nombre: 'Recibo de dinero', monto: 42000, tipoMovimiento: 'Giro postal' },
    { fecha: '2024-04-01', nombre: 'Recibo de dinero', monto: 42000, tipoMovimiento: 'Pago en efectivo' },
    { fecha: '2024-04-01', nombre: 'Recibo de dinero', monto: 42000, tipoMovimiento: 'Pago en efectivo' },
    { fecha: '2024-04-01', nombre: 'Recibo de dinero', monto: 42000, tipoMovimiento: 'Giro postal' },
    { fecha: '2024-04-01', nombre: 'Recibo de dinero', monto: 42000, tipoMovimiento: 'Pago en efectivo' },
    { fecha: '2024-04-01', nombre: 'Recibo de dinero', monto: 42000, tipoMovimiento: 'Pago en efectivo' },
    { fecha: '2024-04-01', nombre: 'Recibo de dinero', monto: 42000, tipoMovimiento: 'Giro postal' },
    { fecha: '2024-04-01', nombre: 'Recibo de dinero', monto: 42000, tipoMovimiento: 'Pago en efectivo' },
    { fecha: '2024-04-01', nombre: 'Recibo de dinero', monto: 42000, tipoMovimiento: 'Pago en efectivo' },
    { fecha: '2024-04-01', nombre: 'Recibo de dinero', monto: 42000, tipoMovimiento: 'Giro postal' },
    { fecha: '2024-04-01', nombre: 'Recibo de dinero', monto: 42000, tipoMovimiento: 'Pago en efectivo' },
    { fecha: '2024-04-01', nombre: 'Recibo de dinero', monto: 42000, tipoMovimiento: 'Pago en efectivo' },
  ];

  myTheme = themeQuartz.withParams({
    backgroundColor: 'var(--clr-surface-a10)',
    spacing: 10,
    accentColor: 'var(--color-primary-darker)',
    foregroundColor: 'var(--color-accent)',
    headerTextColor: 'var(--color-text-inverse)',
    headerBackgroundColor: 'var(--color-accent)',
    oddRowBackgroundColor: 'var(--clr-surface-a10)',
    headerColumnResizeHandleColor: 'var(--color-highlight)'
  });

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
