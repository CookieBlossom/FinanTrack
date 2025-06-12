import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, throwError, of } from 'rxjs';
import { DatabaseService } from './database.service';

export interface IncomeVsExpenses {
  name: string;
  series: Array<{
    name: string;
    value: number;
  }>;
}

export interface CategoryExpense {
  name: string;
  value: number;
}

export interface RecentMovement {
  id: number;
  cardId: number;
  amount: number;
  description: string;
  movementType: 'income' | 'expense';
  movementSource: 'manual' | 'scraper';
  transactionDate: Date;
  category?: string;
  metadata?: {
    originalData?: any;
    scraperTaskId?: string;
    cuenta?: string;
    referencia?: string;
    estado?: string;
    tipo?: string;
  };
}

export interface DashboardSummary {
  totalIngresos: number;
  totalGastos: number;
  saldoActual: number;
  gastosPorCategoria: CategoryExpense[];
  ultimosMovimientos: RecentMovement[];
}

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private apiUrl: string;

  constructor(
    private http: HttpClient,
    private database: DatabaseService
  ) {
    this.apiUrl = database.getApiUrl();
  }

  getIncomeVsExpenses(year?: number): Observable<IncomeVsExpenses[]> {
    console.log('Obteniendo ingresos vs gastos para el año:', year);
    let params = new HttpParams();
    if (year) {
      params = params.set('year', year.toString());
    }
    return this.http.get<IncomeVsExpenses[]>(`${this.apiUrl}/dashboard/income-expenses`, { 
      params,
      responseType: 'json' as const
    }).pipe(
      catchError(error => {
        console.error('Error en getIncomeVsExpenses:', error);
        return of([]);
      })
    );
  }

  getCategoryExpenses(year?: number, month?: number): Observable<CategoryExpense[]> {
    console.log('Obteniendo gastos por categoría para año:', year, 'mes:', month);
    let params = new HttpParams();
    if (year) {
      params = params.set('year', year.toString());
    }
    if (month) {
      params = params.set('month', month.toString());
    }
    return this.http.get<CategoryExpense[]>(`${this.apiUrl}/dashboard/category-expenses`, {
      params,
      responseType: 'json' as const
    }).pipe(
      catchError(error => {
        console.error('Error en getCategoryExpenses:', error);
        return of([]);
      })
    );
  }

  getRecentMovements(limit: number = 10): Observable<RecentMovement[]> {
    console.log('Obteniendo movimientos recientes, límite:', limit);
    const params = new HttpParams().set('limit', limit.toString());
    return this.http.get<RecentMovement[]>(`${this.apiUrl}/dashboard/recent-movements`, {
      params,
      responseType: 'json' as const
    }).pipe(
      catchError(error => {
        console.error('Error en getRecentMovements:', error);
        return of([]);
      })
    );
  }

  getDashboardSummary(): Observable<DashboardSummary> {
    console.log('Obteniendo resumen del dashboard');
    return this.http.get<DashboardSummary>(`${this.apiUrl}/dashboard/summary`, {
      responseType: 'json' as const
    }).pipe(
      catchError(error => {
        console.error('Error en getDashboardSummary:', error);
        return throwError(() => error);
      })
    );
  }
} 