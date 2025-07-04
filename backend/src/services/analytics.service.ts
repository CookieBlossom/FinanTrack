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

    public async getAnalyticsDataByMonth(userId: number, year: number, month: number): Promise<IAnalyticsData> {
        try {
            // Obtener datos del gráfico (mantenemos el rango anual para contexto)
            const chartData = await this.getChartData(userId);
            
            // Obtener resumen específico del mes seleccionado
            const monthlySummary = await this.getMonthlySummaryByMonth(userId, year, month);
            
            // Los límites de gasto se mantienen igual
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
            console.error('Error al obtener datos de analytics por mes:', error);
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
            // Obtener datos reales de transacciones de los últimos 12 meses
            const realTransactionsQuery = `
                SELECT 
                    DATE_TRUNC('month', transaction_date) as month,
                    movement_type as type,
                    SUM(ABS(amount)) as total
                FROM movements m
                JOIN cards c ON m.card_id = c.id
                WHERE c.user_id = $1
                AND transaction_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '11 months')
                GROUP BY DATE_TRUNC('month', transaction_date), movement_type
                ORDER BY month ASC
            `;

            const result = await this.pool.query(realTransactionsQuery, [userId]);

            // PRIORIDAD 1: Verificar si hay movimientos proyectados
            const projectedMovementsQuery = `
                SELECT 
                    DATE_TRUNC('month', expected_date) as month,
                    movement_type as type,
                    SUM(ABS(amount)) as total
                FROM projected_movements pm
                WHERE pm.user_id = $1
                AND pm.status = 'pending'
                AND expected_date >= CURRENT_DATE
                AND expected_date <= DATE_TRUNC('month', CURRENT_DATE + INTERVAL '6 months')
                GROUP BY DATE_TRUNC('month', expected_date), movement_type
                ORDER BY month ASC
            `;

            const projectedResult = await this.pool.query(projectedMovementsQuery, [userId]);
            const hasProjectedMovements = projectedResult.rows.length > 0;

            // PRIORIDAD 2: Si no hay movimientos proyectados pero hay movimientos reales
            let expectedSubscriptions = [];
            let expectedBudgets = [];

            if (hasProjectedMovements) {
                // Usar movimientos proyectados existentes
                expectedSubscriptions = projectedResult.rows.filter(row => row.type === 'income') || [];
                expectedBudgets = projectedResult.rows.filter(row => row.type === 'expense') || [];
            } else if (result.rows.length > 0) {
                // Generar proyecciones automáticas basadas en historial
                const autoProjections = await this.generateAutoProjections(userId);
                expectedSubscriptions = autoProjections.expectedSubscriptions;
                expectedBudgets = autoProjections.expectedBudgets;
            }

            return {
                realTransactions: result.rows || [],
                expectedSubscriptions,
                expectedBudgets
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
            // Primero, encontrar el mes con más movimientos de los últimos 12 meses
            const findBestMonthQuery = `
                SELECT 
                    DATE_TRUNC('month', transaction_date) as month,
                    COUNT(*) as movement_count,
                    SUM(ABS(amount)) as total_amount,
                    COUNT(CASE WHEN movement_type = 'expense' THEN 1 END) as expense_count
                FROM movements mov
                JOIN cards card ON mov.card_id = card.id
                WHERE card.user_id = $1
                AND transaction_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '12 months')
                GROUP BY DATE_TRUNC('month', transaction_date)
                ORDER BY expense_count DESC, movement_count DESC, total_amount DESC
                LIMIT 1
            `;
            
            const bestMonthResult = await this.pool.query(findBestMonthQuery, [userId]);
            
            let startOfMonth, endOfMonth;
            if (bestMonthResult.rows.length > 0) {
                // Usar el mes con más movimientos
                const bestMonth = new Date(bestMonthResult.rows[0].month);
                startOfMonth = new Date(bestMonth.getFullYear(), bestMonth.getMonth(), 1);
                endOfMonth = new Date(bestMonth.getFullYear(), bestMonth.getMonth() + 1, 0);
            } else {
                // Fallback: buscar cualquier mes con gastos
                const anyMonthQuery = `
                    SELECT 
                        DATE_TRUNC('month', transaction_date) as month,
                        COUNT(*) as movement_count
                    FROM movements mov
                    JOIN cards card ON mov.card_id = card.id
                    WHERE card.user_id = $1
                    AND mov.movement_type = 'expense'
                    GROUP BY DATE_TRUNC('month', transaction_date)
                    ORDER BY movement_count DESC
                    LIMIT 1
                `;
                const anyMonthResult = await this.pool.query(anyMonthQuery, [userId]);
                
                if (anyMonthResult.rows.length > 0) {
                    const anyMonth = new Date(anyMonthResult.rows[0].month);
                    startOfMonth = new Date(anyMonth.getFullYear(), anyMonth.getMonth(), 1);
                    endOfMonth = new Date(anyMonth.getFullYear(), anyMonth.getMonth() + 1, 0);
                } else {
                    // Último fallback al mes actual
                    const currentMonth = new Date();
                    startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
                    endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
                }
            }

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

    private async getMonthlySummaryByMonth(userId: number, year: number, month: number) {
        try {
            // Definir el rango del mes específico
            const startOfMonth = new Date(year, month - 1, 1);
            const endOfMonth = new Date(year, month, 0);

            // Obtener el total de gastos del mes específico para calcular porcentajes
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

            // Obtener gastos por categoría del mes específico
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

            // Obtener gastos por método de pago (tarjeta) del mes específico
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

            // Obtener gastos por fecha del mes específico
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
            console.error('Error al obtener resumen mensual específico:', error);
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

    /**
     * Genera proyecciones automáticas basadas en el historial de movimientos
     * Calcula promedios mensuales por categoría de los últimos 3 meses
     */
    private async generateAutoProjections(userId: number) {
        try {
            // Obtener promedios mensuales por categoría de los últimos 3 meses
            const historicalDataQuery = `
                SELECT 
                    mov.movement_type as type,
                    cat.name_category as category,
                    AVG(ABS(mov.amount)) as avg_amount,
                    COUNT(*) as frequency
                FROM movements mov
                JOIN cards card ON mov.card_id = card.id
                LEFT JOIN categories cat ON mov.category_id = cat.id
                WHERE card.user_id = $1
                AND mov.transaction_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '3 months')
                AND mov.transaction_date < DATE_TRUNC('month', CURRENT_DATE)
                GROUP BY mov.movement_type, cat.name_category
                HAVING COUNT(*) >= 2  -- Solo categorías con al menos 2 transacciones
                ORDER BY avg_amount DESC
            `;

            const historicalResult = await this.pool.query(historicalDataQuery, [userId]);

            if (historicalResult.rows.length === 0) {
                return {
                    expectedSubscriptions: [],
                    expectedBudgets: []
                };
            }

            // Generar proyecciones para el próximo mes
            const nextMonth = new Date();
            nextMonth.setMonth(nextMonth.getMonth() + 1);
            nextMonth.setDate(1); // Primer día del próximo mes

            const projectedIncome = [];
            const projectedExpenses = [];

            // Procesar cada categoría histórica
            for (const row of historicalResult.rows) {
                const avgAmount = parseFloat(row.avg_amount);
                const frequency = parseInt(row.frequency);
                const type = row.type;
                const category = row.category || 'Otros';

                // Calcular proyección basada en frecuencia y promedio
                // Si la frecuencia es alta (más de 6 movimientos en 3 meses), proyectar el promedio
                // Si es baja, proyectar con factor de reducción
                const projectedAmount = frequency >= 6 ? avgAmount : avgAmount * 0.7;

                const projection = {
                    month: nextMonth,
                    type: type,
                    total: Math.round(projectedAmount),
                    category: category,
                    confidence: frequency >= 6 ? 0.8 : 0.6 // Nivel de confianza
                };

                if (type === 'income') {
                    projectedIncome.push(projection);
                } else {
                    projectedExpenses.push(projection);
                }
            }

            // Consolidar por mes y tipo (sumar todos los gastos/ingresos del mes)
            const consolidatedIncome = this.consolidateProjections(projectedIncome);
            const consolidatedExpenses = this.consolidateProjections(projectedExpenses);

            return {
                expectedSubscriptions: consolidatedIncome,
                expectedBudgets: consolidatedExpenses
            };

        } catch (error) {
            console.error('Error al generar proyecciones automáticas:', error);
            return {
                expectedSubscriptions: [],
                expectedBudgets: []
            };
        }
    }

    /**
     * Consolida proyecciones por mes y tipo
     */
    private consolidateProjections(projections: any[]) {
        const consolidated = new Map();

        projections.forEach(proj => {
            const key = `${proj.month.toISOString().substring(0, 7)}-${proj.type}`;
            
            if (consolidated.has(key)) {
                const existing = consolidated.get(key);
                existing.total += proj.total;
                existing.confidence = Math.max(existing.confidence, proj.confidence);
            } else {
                consolidated.set(key, {
                    month: proj.month,
                    type: proj.type,
                    total: proj.total,
                    confidence: proj.confidence
                });
            }
        });

        return Array.from(consolidated.values());
    }
}