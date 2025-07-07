import { Component, ElementRef, ViewChild, AfterViewInit, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LegendPosition, NgxChartsModule, ScaleType } from '@swimlane/ngx-charts';
import { AgGridModule } from 'ag-grid-angular';
import { MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { curveLinear } from 'd3-shape';
import { AnalyticsService, AnalyticsData } from '../../services/analytics.service';

interface ChartDataPoint {
    name: string;
    value: number;
}

interface ChartSeries {
    name: string;
    series: ChartDataPoint[];
}

interface SpendingLimit {
    id: number;
    name: string;
    limit: number;
    used: number;
    type: 'card' | 'cash' | 'category';
}

@Component({
    selector: 'app-analytics',
    standalone: true,
    templateUrl: './analytics.component.html',
    styleUrls: ['./analytics.component.css'],
    imports: [
        CommonModule, 
        NgxChartsModule, 
        AgGridModule, 
        MatButtonModule, 
        MatIconModule
    ],
})
export class AnalyticsComponent implements AfterViewInit, OnInit {
    @ViewChild('chartContainer') chartContainerRef!: ElementRef<HTMLDivElement>;
    @ViewChild('chartContainer', { read: ElementRef }) chartEl!: ElementRef<HTMLElement>;

    selectedMonth: string | null = null;
    monthData: ChartDataPoint | null = null;
    chartView: [number, number] = [300, 300];
    curve = curveLinear;
    legendPosition: LegendPosition = LegendPosition.Below;
    hasData: boolean = false;
    isLoading: boolean = true;
    error: string | null = null;

    colorScheme = {
        name: 'custom',
        selectable: true,
        group: ScaleType.Ordinal,
        domain: ['#4CAF50', '#F44336', '#2196F3', '#FF9800'],
    };

    chartData: ChartSeries[] = [];
    spendingLimits: SpendingLimit[] = [];
    monthlySummary: AnalyticsData['monthlySummary'] | null = null;
    monthToYearMap: Map<string, number> = new Map(); // Mapear mes a año real

    constructor(
        private dialog: MatDialog,
        private cdr: ChangeDetectorRef,
        private analyticsService: AnalyticsService
    ) {}

    ngOnInit(): void {
        this.loadAnalyticsData();
    }

    loadAnalyticsData(): void {
        this.isLoading = true;
        this.error = null;
        this.chartData = []; // Limpiar datos anteriores
        
        this.analyticsService.refreshData().subscribe({
            next: (data: AnalyticsData) => {
                this.hasData = data.hasData;
                this.spendingLimits = data.spendingLimits;
                this.monthlySummary = data.monthlySummary;
                
                if (this.hasData) {
                    this.processChartData(data);
                }
                
                this.isLoading = false;
                this.cdr.detectChanges();
            },
            error: (error) => {
                console.error('Error al cargar datos de analytics:', error);
                this.error = 'Error al cargar los datos. Por favor, intente nuevamente.';
                this.isLoading = false;
                this.hasData = false;
                this.cdr.detectChanges();
            }
        });
    }

    private processChartData(data: AnalyticsData): void {
        const months = new Set<string>();
        const seriesMap = new Map<string, Map<string, number>>();
        this.monthToYearMap.clear(); // Limpiar mapeo anterior

        // Procesar transacciones reales
        if (data.chartData.realTransactions.length > 0) {
            data.chartData.realTransactions.forEach((transaction: { month: string; type: string; total: number }) => {
                const transactionDate = new Date(transaction.month);
                const month = this.formatMonth(transactionDate);
                const year = transactionDate.getFullYear();
                
                months.add(month);
                this.monthToYearMap.set(month, year);
                
                if (!seriesMap.has(month)) {
                    seriesMap.set(month, new Map());
                }
                seriesMap.get(month)?.set(transaction.type, transaction.total);
            });
        }

        // Procesar suscripciones esperadas
        if (data.chartData.expectedSubscriptions.length > 0) {
            data.chartData.expectedSubscriptions.forEach((subscription: { month: string; type: string; total: number }) => {
                const subscriptionDate = new Date(subscription.month);
                const month = this.formatMonth(subscriptionDate);
                const year = subscriptionDate.getFullYear();
                
                months.add(month);
                this.monthToYearMap.set(month, year);
                
                if (!seriesMap.has(month)) {
                    seriesMap.set(month, new Map());
                }
                seriesMap.get(month)?.set('expected_income', subscription.total);
            });
        }

        // Procesar presupuestos esperados
        if (data.chartData.expectedBudgets.length > 0) {
            data.chartData.expectedBudgets.forEach((budget: { month: string; type: string; total: number }) => {
                const budgetDate = new Date(budget.month);
                const month = this.formatMonth(budgetDate);
                const year = budgetDate.getFullYear();
                
                months.add(month);
                this.monthToYearMap.set(month, year);
                
                if (!seriesMap.has(month)) {
                    seriesMap.set(month, new Map());
                }
                seriesMap.get(month)?.set('expected_expense', budget.total);
            });
        }

        // Convertir a formato de series y ordenar por fecha
        const sortedMonths = Array.from(months).sort((a, b) => {
            const yearA = this.monthToYearMap.get(a) || 0;
            const yearB = this.monthToYearMap.get(b) || 0;
            if (yearA !== yearB) return yearA - yearB;
            
            const monthIndexA = this.getMonthIndex(a);
            const monthIndexB = this.getMonthIndex(b);
            return monthIndexA - monthIndexB;
        });

        const series: ChartSeries[] = [
            { name: 'Ingresos Reales', series: [] },
            { name: 'Costos Reales', series: [] },
            { name: 'Ingresos Esperados', series: [] },
            { name: 'Costos Esperados', series: [] }
        ];

        sortedMonths.forEach(month => {
            const monthData = seriesMap.get(month);
            if (monthData) {
                const year = this.monthToYearMap.get(month);
                const monthLabel = `${month} ${year}`;
                
                series[0].series.push({ name: monthLabel, value: monthData.get('income') || 0 });
                series[1].series.push({ name: monthLabel, value: monthData.get('expense') || 0 });
                series[2].series.push({ name: monthLabel, value: monthData.get('expected_income') || 0 });
                series[3].series.push({ name: monthLabel, value: monthData.get('expected_expense') || 0 });
            }
        });

        // Filtrar series vacías y actualizar chartData
        this.chartData = series.filter(series => 
            series.series.some(point => point.value > 0)
        );
    }

    private formatMonth(date: Date): string {
        return date.toLocaleString('es-ES', { month: 'short' });
    }

    // Función auxiliar para convertir nombre de mes a índice
    private getMonthIndex(monthName: string): number {
        const months = [
            'ene', 'feb', 'mar', 'abr', 'may', 'jun',
            'jul', 'ago', 'sep', 'oct', 'nov', 'dic'
        ];
        return months.indexOf(monthName.toLowerCase());
    }

    onXAxisLabelClick(monthLabel: string) {
        this.selectedMonth = monthLabel;
        const point = this.chartData[0].series.find(d => d.name === monthLabel);
        this.monthData = point || null;
        
        // Extraer mes y año del label
        const [month, year] = monthLabel.split(' ');
        const monthIndex = this.getMonthIndex(month);
        
        if (monthIndex !== -1 && year) {
            this.loadMonthlyStatistics(parseInt(year), monthIndex + 1);
        }
    }

    // Función para obtener estadísticas de un mes específico
    loadMonthlyStatistics(year: number, month: number): void {
        this.analyticsService.getAnalyticsDataByMonth(year, month).subscribe({
            next: (data: AnalyticsData) => {
                this.monthlySummary = data.monthlySummary;
                this.cdr.detectChanges();
            },
            error: (error) => {
                console.error('Error al cargar estadísticas mensuales:', error);
                this.error = 'Error al cargar los datos del mes seleccionado.';
                this.cdr.detectChanges();
            }
        });
    }

    // Función para resetear a vista general
    resetToGeneralView(): void {
        this.selectedMonth = null;
        this.monthData = null;
        this.loadAnalyticsData(); // Recargar datos generales
    }

    // Getter para el título del resumen
    get summaryTitle(): string {
        if (this.selectedMonth) {
            // Separar el mes y año del label seleccionado
            const [monthStr] = this.selectedMonth.split(' ');
            const monthIndex = this.getMonthIndex(monthStr);
            
            if (monthIndex !== -1) {
                // Obtener el nombre completo del mes
                const monthNames = [
                    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
                ];
                const monthName = monthNames[monthIndex];
                const year = this.monthToYearMap.get(monthStr) || new Date().getFullYear();
                return `Resumen de ${monthName} ${year}`;
            }
        }
        return 'Resumen General';
    }
    formatPercentage(value: number | null | undefined): string {
        if (value === null || value === undefined) {
            return '-';
        }
        return `${value.toFixed(1)}%`;
    }

    formatAmount(value: number | null | undefined): string {
        if (value === null || value === undefined) {
            return '-';
        }
        return value.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 });
    }

    // Función específica para el formato del gráfico (bind para mantener contexto)
    formatChartAmount = (value: number): string => {
        if (value === 0) return '$0';
        
        // Para números grandes, usar formato compacto
        if (Math.abs(value) >= 1000000) {
            return `$${(value / 1000000).toFixed(1)}M`;
        } else if (Math.abs(value) >= 1000) {
            return `$${(value / 1000).toFixed(0)}K`;
        }
        
        // Para números normales, sin decimales si es entero
        if (value % 1 === 0) {
            return `$${value.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
        }
        
        return `$${value.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    }

    formatDate(value: Date | null | undefined): string {
        if (value === null || value === undefined) {
            return 'No hay datos';
        }
        return new Date(value).toLocaleDateString('es-ES');
    }

    ngAfterViewInit(): void {
        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                const width = entry.contentRect.width * 0.95;
                const height = entry.contentRect.height * 0.8;
                this.chartView = [width, height];
                this.cdr.detectChanges();
            }
        });

        resizeObserver.observe(this.chartContainerRef.nativeElement);

        // Observador para detectar los ticks del eje X
        const mutationObserver = new MutationObserver(() => {
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
                mutationObserver.disconnect();
            }
        });

        mutationObserver.observe(this.chartEl.nativeElement, {
            childList: true,
            subtree: true,
        });
    }
}

