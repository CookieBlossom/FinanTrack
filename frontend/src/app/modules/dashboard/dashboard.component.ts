import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardService, MonthlyExpenses } from '../../services/dashboard.service';
import { forkJoin } from 'rxjs';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  topExpenses: any[] = [];
  projectedMovements: any[] = [];
  financialSummary: any = {};
  monthlyExpenses: MonthlyExpenses[] = [];
  loading = true;
  error = false;

  constructor(private dashboardService: DashboardService) {}

  ngOnInit() {
    this.loadDashboardData();
  }

  loadDashboardData() {
    // Limpiar datos existentes
    this.topExpenses = [];
    this.projectedMovements = [];
    this.financialSummary = {};
    this.monthlyExpenses = [];
    this.loading = true;
    this.error = false;

    // Crear un objeto con todas las llamadas
    const dashboardCalls = {
      financialSummary: this.dashboardService.getFinancialSummary(),
      topExpenses: this.dashboardService.getTopExpenses(),
      projectedMovements: this.dashboardService.getProjectedMovements(),
      expensesByCategory: this.dashboardService.getExpensesByCategory()
    };

    // Ejecutar todas las llamadas en paralelo
    forkJoin(dashboardCalls).subscribe({
      next: (results) => {
        console.log('Datos recibidos:', results);
        this.financialSummary = results.financialSummary;
        this.topExpenses = results.topExpenses;
        this.projectedMovements = results.projectedMovements;
        this.monthlyExpenses = results.expensesByCategory;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al cargar datos del dashboard:', error);
        this.error = true;
        this.loading = false;
      }
    });
  }

  // Función para formatear el mes (YYYY-MM a texto)
  formatMonth(monthStr: string): string {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
  }

  // Función auxiliar para formatear montos
  formatAmount(value: number): string {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  }

  // Función para formatear fechas en formato dd/MM/yyyy
  formatDate(date: string | Date): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  // Función para calcular el porcentaje de una categoría dentro de su mes
  calculatePercentage(monthExpenses: MonthlyExpenses, category: string): string {
    const total = monthExpenses.expenses.reduce((sum, exp) => sum + exp.total, 0);
    const categoryTotal = monthExpenses.expenses.find(exp => exp.category === category)?.total || 0;
    return total > 0 ? `${((categoryTotal / total) * 100).toFixed(1)}%` : '0%';
  }

  // Función para determinar el estado del balance
  getBalanceState(balance: number): 'positive' | 'neutral' | 'negative' {
    if (balance > 0) return 'positive';
    if (balance < 0) return 'negative';
    return 'neutral';
  }

  // Función para obtener el color del balance
  getBalanceColor(): string {
    const balance = this.financialSummary?.totalBalance || 0;
    return this.getBalanceState(balance);
  }
}