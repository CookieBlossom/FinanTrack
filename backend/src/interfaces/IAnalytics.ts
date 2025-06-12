export interface IAnalyticsData {
    // Datos para el gráfico
    chartData: {
        realTransactions: {
            month: Date;
            type: string;
            total: number;
        }[];
        expectedSubscriptions: {
            month: Date;
            type: string;
            total: number;
        }[];
        expectedBudgets: {
            month: Date;
            total: number;
        }[];
    };

    // Resumen del mes seleccionado
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
                date: Date | null;
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
                date: Date | null;
                amount: number;
                percentage: number;
            };
        };
    };

    // Límites y presupuestos
    spendingLimits: {
        id: number;
        name: string;
        limit: number;
        used: number;
        type: 'card' | 'cash' | 'category';
    }[];

    // Indicador de si hay datos disponibles
    hasData: boolean;
} 