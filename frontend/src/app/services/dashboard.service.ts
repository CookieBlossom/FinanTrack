import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';

export interface TopExpense {
  id: number;
  description: string;
  amount: number;
  transactionDate: Date;
  category: string;
}

export interface CategoryExpense {
  name: string;
  value: number;
}

export interface FinancialCard {
  id: number;
  name: string;
  accountHolder: string;
  balance: number;
}

export interface FinancialSummary {
  totalBalance: number;
  isPositive: boolean;
  cards: FinancialCard[];
}

export interface ProjectedMovement {
  id: number;
  description: string;
  amount: number;
  expectedDate: Date;
  movementType: 'income' | 'expense';
  status: 'pending' | 'completed' | 'cancelled';
  probability: number;
}

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getTopExpenses(): Observable<any> {
    return this.http.get(`${this.apiUrl}/dashboard/top-expenses`).pipe(
      catchError(error => {
        console.error('Error al obtener top expenses:', error);
        return throwError(() => error);
      })
    );
  }

  getProjectedMovements(): Observable<any> {
    return this.http.get(`${this.apiUrl}/dashboard/projected-movements`).pipe(
      catchError(error => {
        console.error('Error al obtener movimientos proyectados:', error);
        return throwError(() => error);
      })
    );
  }

  getFinancialSummary(): Observable<any> {
    return this.http.get(`${this.apiUrl}/dashboard/financial-summary`).pipe(
      catchError(error => {
        console.error('Error al obtener resumen financiero:', error);
        return throwError(() => error);
      })
    );
  }

  getExpensesByCategory(): Observable<any> {
    return this.http.get(`${this.apiUrl}/dashboard/expenses-by-category`).pipe(
      catchError(error => {
        console.error('Error al obtener gastos por categoría:', error);
        return throwError(() => error);
      })
    );
  }
} 