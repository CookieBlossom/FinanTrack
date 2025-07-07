import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface AnalyticsData {
    hasData: boolean;
    chartData: {
        realTransactions: Array<{
            month: string;
            type: string;
            total: number;
        }>;
        expectedSubscriptions: Array<{
            month: string;
            type: string;
            total: number;
        }>;
        expectedBudgets: Array<{
            month: string;
            type: string;
            total: number;
        }>;
    };
    monthlySummary: {
        highestExpense: {
            category: {
                name: string;
                amount: number;
                percentage: number;
            };
            paymentMethod: {
                name: string;
                amount: number;
                percentage: number;
            };
            date: {
                date: Date;
                amount: number;
                percentage: number;
            };
        };
        lowestExpense: {
            category: {
                name: string;
                amount: number;
                percentage: number;
            };
            paymentMethod: {
                name: string;
                amount: number;
                percentage: number;
            };
            date: {
                date: Date;
                amount: number;
                percentage: number;
            };
        };
    };
    spendingLimits: Array<{
        id: number;
        name: string;
        limit: number;
        used: number;
        type: 'card' | 'cash' | 'category';
    }>;
}

@Injectable({
    providedIn: 'root'
})
export class AnalyticsService {
    private apiUrl = `${environment.apiUrl}/analytics`;
    private analyticsData = new BehaviorSubject<AnalyticsData | null>(null);
    analyticsData$ = this.analyticsData.asObservable();

    constructor(private http: HttpClient) {}

    getAnalyticsData(): Observable<AnalyticsData> {
        return this.http.get<AnalyticsData>(this.apiUrl).pipe(
            map(data => this.processAnalyticsData(data)),
            tap(data => this.analyticsData.next(data))
        );
    }

    getAnalyticsDataByMonth(year: number, month: number): Observable<AnalyticsData> {
        return this.http.get<AnalyticsData>(`${this.apiUrl}/month/${year}/${month}`).pipe(
            map(data => this.processAnalyticsData(data))
        );
    }

    private processAnalyticsData(data: AnalyticsData): AnalyticsData {
        // Ordenar transacciones por fecha
        data.chartData.realTransactions = this.sortTransactionsByDate(data.chartData.realTransactions);
        data.chartData.expectedSubscriptions = this.sortTransactionsByDate(data.chartData.expectedSubscriptions);
        data.chartData.expectedBudgets = this.sortTransactionsByDate(data.chartData.expectedBudgets);

        return data;
    }

    private sortTransactionsByDate(transactions: Array<{month: string; type: string; total: number}>): Array<{month: string; type: string; total: number}> {
        return transactions.sort((a, b) => {
            const dateA = new Date(a.month);
            const dateB = new Date(b.month);
            return dateA.getTime() - dateB.getTime();
        });
    }

    clearData(): void {
        this.analyticsData.next(null);
    }

    refreshData(): Observable<AnalyticsData> {
        this.clearData();
        return this.getAnalyticsData();
    }
} 