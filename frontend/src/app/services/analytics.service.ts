import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
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

    constructor(private http: HttpClient) {}

    getAnalyticsData(): Observable<AnalyticsData> {
        return this.http.get<AnalyticsData>(this.apiUrl);
    }
} 