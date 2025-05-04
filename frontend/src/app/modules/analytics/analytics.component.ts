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
  @ViewChild('chart', { read: ElementRef }) chartEl!: ElementRef<HTMLElement>;

  selectedMonth: string | null = null;
  monthData: any = null;

  ngAfterViewInit() {
    const observer = new MutationObserver(() => {
      const ticks = this.chartEl.nativeElement.querySelectorAll('g.x.axis g.tick text');
      if (ticks.length > 0) {
        ticks.forEach((tick: any) => {
          tick.style.cursor = 'pointer';
          tick.style.fill = 'var(--color-primary)';
          tick.style.fontWeight = '600';
          tick.addEventListener('click', () => {
            const month = tick.textContent?.trim();
            if (month) this.onXAxisLabelClick(month);
          });
        });
        observer.disconnect();
      }
    });

    observer.observe(this.chartEl.nativeElement, {
      childList: true,
      subtree: true,
    });
  }

  onXAxisLabelClick(month: string) {
    this.selectedMonth = month;
    const point = this.chartData[0].series.find((d: any) => d.name === month);
    this.monthData = point || null;
  }

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
        { name: 'Ene', value: 280000 },
        { name: 'Feb', value: 295000 },
        { name: 'Mar', value: 305000 },
        { name: 'Abr', value: 320000 },
        { name: 'May', value: 335000 },
        { name: 'Jun', value: 345000 },
        { name: 'Jul', value: 355000 },
        { name: 'Ago', value: 365000 },
        { name: 'Sep', value: 375000 },
        { name: 'Oct', value: 385000 },
        { name: 'Nov', value: 395000 },
        { name: 'Dic', value: 405000 },
      ],
    }
  ];
}
