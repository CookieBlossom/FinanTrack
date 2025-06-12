import { Pool } from 'pg';
import { pool } from '../config/database/connection';
import { IAnalyticsData } from '../interfaces/IAnalytics';

export class AnalyticsService {
    private pool: Pool;

    constructor() {
        this.pool = pool;
    }

    // async getAnalyticsData(userId: number): Promise<IAnalyticsData> {
    //     try {
    //         // Obtener datos para el gráfico
    //         const [chartData, monthlySummary, spendingLimits] = await Promise.all([

    //         ]);

    //         // Verificar si hay datos para mostrar
    //         const hasData = this.hasAnyData(chartData);

    //         return {
    //             chartData,
    //             monthlySummary,
    //             spendingLimits,
    //             hasData
    //         };
    //     } catch (error) {
    //         console.error('Error al obtener datos de analytics:', error);
    //         return {
    //             chartData: {
    //                 realTransactions: [],
    //                 expectedSubscriptions: [],
    //                 expectedBudgets: []
    //             },
    //             monthlySummary: {
    //                 highestExpense: {
    //                     category: { name: 'No hay datos', amount: 0, percentage: 0 },
    //                     paymentMethod: { name: 'No hay datos', amount: 0, percentage: 0 },
    //                     date: { date: null, amount: 0, percentage: 0 }
    //                 },
    //                 lowestExpense: {
    //                     category: { name: 'No hay datos', amount: 0, percentage: 0 },
    //                     paymentMethod: { name: 'No hay datos', amount: 0, percentage: 0 },
    //                     date: { date: null, amount: 0, percentage: 0 }
    //                 }
    //             },
    //             spendingLimits: [],
    //             hasData: false
    //         };
    //     }
    // }

//     private hasAnyData(chartData: IAnalyticsData['chartData']): boolean {
//         return (
//             chartData.realTransactions.length > 0 ||
//             chartData.expectedSubscriptions.length > 0 ||
//             chartData.expectedBudgets.length > 0
//         );
//     }

//     private async getChartData(userId: number) {
//         try {
//             // Obtener datos reales de transacciones
//             const realTransactionsQuery = `
//                 SELECT 
//                     DATE_TRUNC('month', transaction_date) as month,
//                     movement_type as type,
//                     SUM(amount) as total
//                 FROM movements m
//                 JOIN cards c ON m.card_id = c.id
//                 WHERE c.user_id = $1
//                 AND transaction_date >= DATE_TRUNC('year', CURRENT_DATE)
//                 GROUP BY DATE_TRUNC('month', transaction_date), movement_type
//                 ORDER BY month ASC
//             `;

//             // Obtener datos esperados de suscripciones
//             const expectedSubscriptionsQuery = `
//                 SELECT 
//                     DATE_TRUNC('month', next_billing_date) as month,
//                     'income' as type,
//                     SUM(amount) as total
//                 FROM subscriptions
//                 WHERE user_id = $1
//                 AND status = 'active'
//                 AND next_billing_date >= DATE_TRUNC('year', CURRENT_DATE)
//                 GROUP BY DATE_TRUNC('month', next_billing_date)
//                 ORDER BY month ASC
//             `;

//             // Obtener datos esperados de presupuestos
//             const expectedBudgetsQuery = `
//                 SELECT 
//                     DATE_TRUNC('month', start_date) as month,
//                     SUM(amount_limit) as total
//                 FROM budgets
//                 WHERE user_id = $1
//                 AND status = 'active'
//                 AND start_date >= DATE_TRUNC('year', CURRENT_DATE)
//                 GROUP BY DATE_TRUNC('month', start_date)
//                 ORDER BY month ASC
//             `;

//             const [realTransactions, expectedSubscriptions, expectedBudgets] = await Promise.all([
//                 this.pool.query(realTransactionsQuery, [userId]),
//                 this.pool.query(expectedSubscriptionsQuery, [userId]),
//                 this.pool.query(expectedBudgetsQuery, [userId])
//             ]);

//             return {
//                 realTransactions: realTransactions.rows || [],
//                 expectedSubscriptions: expectedSubscriptions.rows || [],
//                 expectedBudgets: expectedBudgets.rows || []
//             };
//         } catch (error) {
//             console.error('Error al obtener datos del gráfico:', error);
//             return {
//                 realTransactions: [],
//                 expectedSubscriptions: [],
//                 expectedBudgets: []
//             };
//         }
//     }

//     private async getMonthlySummary(userId: number) {
//         const currentMonth = new Date();
//         const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
//         const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

//         // Obtener el mayor gasto por categoría
//         const highestExpenseByCategoryQuery = `
//             WITH category_totals AS (
//                 SELECT 
//                     cat.name_category as category_name,
//                     SUM(mov.amount) as total_amount,
//                     SUM(mov.amount) * 100.0 / (SELECT SUM(amount) FROM movements m2 
//                         JOIN cards c2 ON m2.card_id = c2.id 
//                         WHERE c2.user_id = $1 
//                         AND m2.movement_type = 'expense'
//                         AND m2.transaction_date BETWEEN $2 AND $3) as percentage
//                 FROM movements mov
//                 JOIN cards card ON mov.card_id = card.id
//                 JOIN categories cat ON mov.category_id = cat.id
//                 WHERE card.user_id = $1
//                 AND mov.movement_type = 'expense'
//                 AND mov.transaction_date BETWEEN $2 AND $3
//                 GROUP BY cat.name_category
//                 ORDER BY total_amount DESC
//                 LIMIT 1
//             )
//             SELECT 
//                 category_name as name,
//                 total_amount as amount,
//                 percentage
//             FROM category_totals
//         `;

//         // Obtener el mayor gasto por método de pago
//         const highestExpenseByPaymentMethodQuery = `
//             WITH payment_totals AS (
//                 SELECT 
//                     card_type.name as method_name,
//                     SUM(mov.amount) as total_amount,
//                     SUM(mov.amount) * 100.0 / (SELECT SUM(amount) FROM movements m2 
//                         JOIN cards c2 ON m2.card_id = c2.id 
//                         WHERE c2.user_id = $1 
//                         AND m2.movement_type = 'expense'
//                         AND m2.transaction_date BETWEEN $2 AND $3) as percentage
//                 FROM movements mov
//                 JOIN cards card ON mov.card_id = card.id
//                 JOIN card_types card_type ON card.card_type_id = card_type.id
//                 WHERE card.user_id = $1
//                 AND mov.movement_type = 'expense'
//                 AND mov.transaction_date BETWEEN $2 AND $3
//                 GROUP BY card_type.name
//                 ORDER BY total_amount DESC
//                 LIMIT 1
//             )
//             SELECT 
//                 method_name as name,
//                 total_amount as amount,
//                 percentage
//             FROM payment_totals
//         `;

//         // Obtener el mayor gasto por fecha
//         const highestExpenseByDateQuery = `
//             WITH date_totals AS (
//                 SELECT 
//                     transaction_date as date,
//                     SUM(amount) as total_amount,
//                     SUM(amount) * 100.0 / (SELECT SUM(amount) FROM movements m2 
//                         JOIN cards c2 ON m2.card_id = c2.id 
//                         WHERE c2.user_id = $1 
//                         AND m2.movement_type = 'expense'
//                         AND m2.transaction_date BETWEEN $2 AND $3) as percentage
//                 FROM movements mov
//                 JOIN cards card ON mov.card_id = card.id
//                 WHERE card.user_id = $1
//                 AND mov.movement_type = 'expense'
//                 AND mov.transaction_date BETWEEN $2 AND $3
//                 GROUP BY transaction_date
//                 ORDER BY total_amount DESC
//                 LIMIT 1
//             )
//             SELECT 
//                 date,
//                 total_amount as amount,
//                 percentage
//             FROM date_totals
//         `;

//         // Obtener el menor gasto por categoría
//         const lowestExpenseByCategoryQuery = `
//             WITH category_totals AS (
//                 SELECT 
//                     cat.name_category as category_name,
//                     SUM(mov.amount) as total_amount,
//                     SUM(mov.amount) * 100.0 / (SELECT SUM(amount) FROM movements m2 
//                         JOIN cards c2 ON m2.card_id = c2.id 
//                         WHERE c2.user_id = $1 
//                         AND m2.movement_type = 'expense'
//                         AND m2.transaction_date BETWEEN $2 AND $3) as percentage
//                 FROM movements mov
//                 JOIN cards card ON mov.card_id = card.id
//                 JOIN categories cat ON mov.category_id = cat.id
//                 WHERE card.user_id = $1
//                 AND mov.movement_type = 'expense'
//                 AND mov.transaction_date BETWEEN $2 AND $3
//                 GROUP BY cat.name_category
//                 ORDER BY total_amount ASC
//                 LIMIT 1
//             )
//             SELECT 
//                 category_name as name,
//                 total_amount as amount,
//                 percentage
//             FROM category_totals
//         `;

//         // Obtener el menor gasto por método de pago
//         const lowestExpenseByPaymentMethodQuery = `
//             WITH payment_totals AS (
//                 SELECT 
//                     card_type.name as method_name,
//                     SUM(mov.amount) as total_amount,
//                     SUM(mov.amount) * 100.0 / (SELECT SUM(amount) FROM movements m2 
//                         JOIN cards c2 ON m2.card_id = c2.id 
//                         WHERE c2.user_id = $1 
//                         AND m2.movement_type = 'expense'
//                         AND m2.transaction_date BETWEEN $2 AND $3) as percentage
//                 FROM movements mov
//                 JOIN cards card ON mov.card_id = card.id
//                 JOIN card_types card_type ON card.card_type_id = card_type.id
//                 WHERE card.user_id = $1
//                 AND mov.movement_type = 'expense'
//                 AND mov.transaction_date BETWEEN $2 AND $3
//                 GROUP BY card_type.name
//                 ORDER BY total_amount ASC
//                 LIMIT 1
//             )
//             SELECT 
//                 method_name as name,
//                 total_amount as amount,
//                 percentage
//             FROM payment_totals
//         `;

//         // Obtener el menor gasto por fecha
//         const lowestExpenseByDateQuery = `
//             WITH date_totals AS (
//                 SELECT 
//                     transaction_date as date,
//                     SUM(amount) as total_amount,
//                     SUM(amount) * 100.0 / (SELECT SUM(amount) FROM movements m2 
//                         JOIN cards c2 ON m2.card_id = c2.id 
//                         WHERE c2.user_id = $1 
//                         AND m2.movement_type = 'expense'
//                         AND m2.transaction_date BETWEEN $2 AND $3) as percentage
//                 FROM movements mov
//                 JOIN cards card ON mov.card_id = card.id
//                 WHERE card.user_id = $1
//                 AND mov.movement_type = 'expense'
//                 AND mov.transaction_date BETWEEN $2 AND $3
//                 GROUP BY transaction_date
//                 ORDER BY total_amount ASC
//                 LIMIT 1
//             )
//             SELECT 
//                 date,
//                 total_amount as amount,
//                 percentage
//             FROM date_totals
//         `;

//         const [
//             highestCategory,
//             highestPaymentMethod,
//             highestDate,
//             lowestCategory,
//             lowestPaymentMethod,
//             lowestDate
//         ] = await Promise.all([
//             this.pool.query(highestExpenseByCategoryQuery, [userId, startOfMonth, endOfMonth]),
//             this.pool.query(highestExpenseByPaymentMethodQuery, [userId, startOfMonth, endOfMonth]),
//             this.pool.query(highestExpenseByDateQuery, [userId, startOfMonth, endOfMonth]),
//             this.pool.query(lowestExpenseByCategoryQuery, [userId, startOfMonth, endOfMonth]),
//             this.pool.query(lowestExpenseByPaymentMethodQuery, [userId, startOfMonth, endOfMonth]),
//             this.pool.query(lowestExpenseByDateQuery, [userId, startOfMonth, endOfMonth])
//         ]);

//         return {
//             highestExpense: {
//                 category: highestCategory.rows[0] || { name: 'No hay datos', amount: 0, percentage: 0 },
//                 paymentMethod: highestPaymentMethod.rows[0] || { name: 'No hay datos', amount: 0, percentage: 0 },
//                 date: highestDate.rows[0] || { date: null, amount: 0, percentage: 0 }
//             },
//             lowestExpense: {
//                 category: lowestCategory.rows[0] || { name: 'No hay datos', amount: 0, percentage: 0 },
//                 paymentMethod: lowestPaymentMethod.rows[0] || { name: 'No hay datos', amount: 0, percentage: 0 },
//                 date: lowestDate.rows[0] || { date: null, amount: 0, percentage: 0 }
//             }
//         };
//     }

//     private async getSpendingLimits(userId: number) {
//         const query = `
//             SELECT 
//                 b.id,
//                 CASE 
//                     WHEN b.category_id IS NOT NULL THEN cat.name_category
//                     ELSE 'General'
//                 END as name,
//                 b.amount_limit as limit,
//                 COALESCE(
//                     (SELECT SUM(m.amount)
//                     FROM movements m
//                     JOIN cards c ON m.card_id = c.id
//                     WHERE c.user_id = $1
//                     AND m.movement_type = 'expense'
//                     AND m.transaction_date >= b.start_date
//                     AND (b.end_date IS NULL OR m.transaction_date <= b.end_date)
//                     AND (
//                         (b.category_id IS NOT NULL AND m.category_id = b.category_id)
//                         OR (b.category_id IS NULL)
//                     )),
//                     0
//                 ) as used,
//                 CASE 
//                     WHEN b.category_id IS NOT NULL THEN 'category'
//                     ELSE 'general'
//                 END as type
//             FROM budgets b
//             LEFT JOIN categories cat ON b.category_id = cat.id
//             WHERE b.user_id = $1
//             AND b.status = 'active'
//             ORDER BY b.created_at DESC
//         `;

//         const result = await this.pool.query(query, [userId]);
//         return result.rows;
//     }
// } 
}