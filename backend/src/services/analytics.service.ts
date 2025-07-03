import { Pool } from 'pg';
import { pool } from '../config/database/connection';
import { IAnalyticsData } from '../interfaces/IAnalytics';
import { PlanService } from './plan.service';
import { DatabaseError } from '../utils/errors';

export class AnalyticsService {
    private pool: Pool;
    private planService: PlanService;

    constructor() {
        this.pool = pool;
        this.planService = new PlanService();
    }

    // Verificar permisos de analytics
    private async checkAnalyticsPermission(planId: number): Promise<void> {
        const hasPermission = await this.planService.hasPermission(planId, 'advanced_analytics');
        if (!hasPermission) {
            throw new DatabaseError('Tu plan no incluye acceso a analytics avanzados.');
        }
    }

    // Verificar permisos de exportación de datos
    private async checkExportPermission(planId: number): Promise<void> {
        const hasPermission = await this.planService.hasPermission(planId, 'export_data');
        if (!hasPermission) {
            throw new DatabaseError('Tu plan no incluye exportación de datos.');
        }
    }

    public async getAnalyticsData(userId: number): Promise<IAnalyticsData> {
        try {
            // Obtener datos básicos para el gráfico
            const chartData = await this.getChartData(userId);
            const monthlySummary = await this.getMonthlySummary(userId);
            const spendingLimits = await this.getSpendingLimits(userId);

            // Verificar si hay datos para mostrar
            const hasData = this.hasAnyData(chartData);

            return {
                chartData,
                monthlySummary,
                spendingLimits,
                hasData
            };
        } catch (error) {
            console.error('Error al obtener datos de analytics:', error);
            return {
                chartData: {
                    realTransactions: [],
                    expectedSubscriptions: [],
                    expectedBudgets: []
                },
                monthlySummary: {
                    highestExpense: {
                        category: { name: 'No hay datos', amount: 0, percentage: 0 },
                        paymentMethod: { name: 'No hay datos', amount: 0, percentage: 0 },
                        date: { date: null, amount: 0, percentage: 0 }
                    },
                    lowestExpense: {
                        category: { name: 'No hay datos', amount: 0, percentage: 0 },
                        paymentMethod: { name: 'No hay datos', amount: 0, percentage: 0 },
                        date: { date: null, amount: 0, percentage: 0 }
                    }
                },
                spendingLimits: [],
                hasData: false
            };
        }
    }

    private async getUserPlan(userId: number): Promise<{ planId: number } | null> {
        try {
            const query = 'SELECT plan_id FROM user WHERE id = $1';
            const result = await this.pool.query(query, [userId]);
            return result.rows[0] || null;
        } catch (error) {
            console.error('Error al obtener plan del usuario:', error);
            return null;
        }
    }

    private hasAnyData(chartData: IAnalyticsData['chartData']): boolean {
        return (
            chartData.realTransactions.length > 0 ||
            chartData.expectedSubscriptions.length > 0 ||
            chartData.expectedBudgets.length > 0
        );
    }

    private async getChartData(userId: number) {
        try {
            // Obtener datos reales de transacciones
            const realTransactionsQuery = `
                SELECT 
                    DATE_TRUNC('month', transaction_date) as month,
                    movement_type as type,
                    SUM(amount) as total
                FROM movements m
                JOIN cards c ON m.card_id = c.id
                WHERE c.user_id = $1
                AND transaction_date >= DATE_TRUNC('year', CURRENT_DATE)
                GROUP BY DATE_TRUNC('month', transaction_date), movement_type
                ORDER BY month ASC
            `;

            const result = await this.pool.query(realTransactionsQuery, [userId]);

            return {
                realTransactions: result.rows || [],
                expectedSubscriptions: [],
                expectedBudgets: []
            };
        } catch (error) {
            console.error('Error al obtener datos del gráfico:', error);
            return {
                realTransactions: [],
                expectedSubscriptions: [],
                expectedBudgets: []
            };
        }
    }

    private async getMonthlySummary(userId: number) {
        try {
            const currentMonth = new Date();
            const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
            const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

            // Obtener el total de gastos del mes para calcular porcentajes
            const totalExpensesQuery = `
                SELECT COALESCE(SUM(ABS(amount)), 0) as total
                FROM movements mov
                JOIN cards card ON mov.card_id = card.id
                WHERE card.user_id = $1
                AND mov.movement_type = 'expense'
                AND mov.transaction_date BETWEEN $2 AND $3
            `;
            const totalResult = await this.pool.query(totalExpensesQuery, [userId, startOfMonth, endOfMonth]);
            const totalExpenses = parseFloat(totalResult.rows[0].total) || 0;

            // Obtener gastos por categoría
            const expensesByCategoryQuery = `
                SELECT 
                    cat.name_category as name,
                    SUM(ABS(mov.amount)) as amount
                FROM movements mov
                JOIN cards card ON mov.card_id = card.id
                LEFT JOIN categories cat ON mov.category_id = cat.id
                WHERE card.user_id = $1
                AND mov.movement_type = 'expense'
                AND mov.transaction_date BETWEEN $2 AND $3
                GROUP BY cat.name_category
                ORDER BY amount DESC
            `;

            const categoryResult = await this.pool.query(expensesByCategoryQuery, [userId, startOfMonth, endOfMonth]);
            const highestCategory = categoryResult.rows[0] || { name: 'No hay datos', amount: 0 };
            const lowestCategory = categoryResult.rows[categoryResult.rows.length - 1] || { name: 'No hay datos', amount: 0 };

            // Obtener gastos por método de pago (tarjeta)
            const expensesByPaymentMethodQuery = `
                SELECT 
                    COALESCE(card.name_account, 'Sin tarjeta') as name,
                    SUM(ABS(mov.amount)) as amount
                FROM movements mov
                JOIN cards card ON mov.card_id = card.id
                WHERE card.user_id = $1
                AND mov.movement_type = 'expense'
                AND mov.transaction_date BETWEEN $2 AND $3
                GROUP BY card.name_account
                ORDER BY amount DESC
            `;

            const paymentMethodResult = await this.pool.query(expensesByPaymentMethodQuery, [userId, startOfMonth, endOfMonth]);
            const highestPaymentMethod = paymentMethodResult.rows[0] || { name: 'No hay datos', amount: 0 };
            const lowestPaymentMethod = paymentMethodResult.rows[paymentMethodResult.rows.length - 1] || { name: 'No hay datos', amount: 0 };

            // Obtener gastos por fecha
            const expensesByDateQuery = `
                SELECT 
                    transaction_date as date,
                    SUM(ABS(amount)) as amount
                FROM movements mov
                JOIN cards card ON mov.card_id = card.id
                WHERE card.user_id = $1
                AND mov.movement_type = 'expense'
                AND mov.transaction_date BETWEEN $2 AND $3
                GROUP BY transaction_date
                ORDER BY amount DESC
            `;

            const dateResult = await this.pool.query(expensesByDateQuery, [userId, startOfMonth, endOfMonth]);
            const highestDate = dateResult.rows[0] || { date: null, amount: 0 };
            const lowestDate = dateResult.rows[dateResult.rows.length - 1] || { date: null, amount: 0 };

            // Calcular porcentajes
            const calculatePercentage = (amount: number) => {
                return totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0;
            };

            return {
                highestExpense: {
                    category: {
                        name: highestCategory.name,
                        amount: parseFloat(highestCategory.amount) || 0,
                        percentage: calculatePercentage(parseFloat(highestCategory.amount) || 0)
                    },
                    paymentMethod: {
                        name: highestPaymentMethod.name,
                        amount: parseFloat(highestPaymentMethod.amount) || 0,
                        percentage: calculatePercentage(parseFloat(highestPaymentMethod.amount) || 0)
                    },
                    date: {
                        date: highestDate.date,
                        amount: parseFloat(highestDate.amount) || 0,
                        percentage: calculatePercentage(parseFloat(highestDate.amount) || 0)
                    }
                },
                lowestExpense: {
                    category: {
                        name: lowestCategory.name,
                        amount: parseFloat(lowestCategory.amount) || 0,
                        percentage: calculatePercentage(parseFloat(lowestCategory.amount) || 0)
                    },
                    paymentMethod: {
                        name: lowestPaymentMethod.name,
                        amount: parseFloat(lowestPaymentMethod.amount) || 0,
                        percentage: calculatePercentage(parseFloat(lowestPaymentMethod.amount) || 0)
                    },
                    date: {
                        date: lowestDate.date,
                        amount: parseFloat(lowestDate.amount) || 0,
                        percentage: calculatePercentage(parseFloat(lowestDate.amount) || 0)
                    }
                }
            };
        } catch (error) {
            console.error('Error al obtener resumen mensual:', error);
            return {
                highestExpense: {
                    category: { name: 'No hay datos', amount: 0, percentage: 0 },
                    paymentMethod: { name: 'No hay datos', amount: 0, percentage: 0 },
                    date: { date: null, amount: 0, percentage: 0 }
                },
                lowestExpense: {
                    category: { name: 'No hay datos', amount: 0, percentage: 0 },
                    paymentMethod: { name: 'No hay datos', amount: 0, percentage: 0 },
                    date: { date: null, amount: 0, percentage: 0 }
                }
            };
        }
    }

    private async getSpendingLimits(userId: number) {
        try {
            // Por ahora retornamos un array vacío
            return [];
        } catch (error) {
            console.error('Error al obtener límites de gasto:', error);
            return [];
        }
    }
}