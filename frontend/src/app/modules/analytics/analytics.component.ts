import { Component, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LegendPosition, NgxChartsModule } from '@swimlane/ngx-charts';
import { AgGridModule } from 'ag-grid-angular';

@Component({
  selector: 'app-analytics',
  standalone: true,
  templateUrl: './analytics.component.html',
  styleUrls: ['./analytics.component.css'],
  imports: [CommonModule, NgxChartsModule, AgGridModule],
})
export class AnalyticsComponent implements AfterViewInit {
  @ViewChild('chartWrapper') chartWrapper!: ElementRef<HTMLDivElement>;

  innerChartWidth = 700;
  separationBetweenPoints = 0;
  below = LegendPosition.Below;
  chartData = [
    {
      name: 'Ingresos Esperados',
      series: [
        { name: 'Ene', value: 300000 },
        { name: 'Feb', value: 310000 },
        { name: 'Mar', value: 320000 },
        { name: 'Abr', value: 330000 },
        { name: 'May', value: 340000 },
        { name: 'Jun', value: 350000 },
        { name: 'Jul', value: 360000 },
        { name: 'Ago', value: 370000 },
        { name: 'Sep', value: 380000 },
        { name: 'Oct', value: 390000 },
        { name: 'Nov', value: 400000 },
        { name: 'Dic', value: 410000 },
      ],
    },
    {
      name: 'Costos Reales',
      series: [
        { name: 'Ene', value: 300000 },
        { name: 'Feb', value: 310000 },
        { name: 'Mar', value: 320000 },
        { name: 'Abr', value: 330000 },
        { name: 'May', value: 340000 },
        { name: 'Jun', value: 350000 },
        { name: 'Jul', value: 360000 },
        { name: 'Ago', value: 370000 },
        { name: 'Sep', value: 380000 },
        { name: 'Oct', value: 390000 },
        { name: 'Nov', value: 400000 },
        { name: 'Dic', value: 410000 },
      ],
    }
  ];

  meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  selectedMonth: string = 'Ene';

  ngAfterViewInit() {
    setTimeout(() => {
      this.updateInnerChartWidth();
    }, 500);
  }

  updateInnerChartWidth() {
    const tooltipArea = this.chartWrapper.nativeElement.querySelector('.tooltip-area') as HTMLElement;
    if (tooltipArea) {
      this.innerChartWidth = tooltipArea.getBoundingClientRect().width;
    }
  }


  filtrarPorMes(mes: string) {
    this.selectedMonth = mes;
  }
}
