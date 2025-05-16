import { Pool } from 'pg';
import { IBudget, IBudgetCreate, IBudgetUpdate } from '../interfaces/IBudget';
import { pool } from '../config/database/connection';

export class BudgetService {
    private pool: Pool;

    constructor() {
        this.pool = pool;
    }

    async getAllBudgetsByUserId(userId: number): Promise<IBudget[]> {
        const query = `
            SELECT 
                b.id, 
                b.user_id as "userId", 
                b.category_id as "categoryId", 
                b.amount_limit as "amountLimit",
                b.period,
                b.start_date as "startDate",
                b.end_date as "endDate",
                b.alert_threshold as "alertThreshold",
                b.status,
                b.created_at as "createdAt", 
                b.updated_at as "updatedAt"
            FROM budgets b
            WHERE b.user_id = $1
            ORDER BY b.start_date DESC
        `;
        const result = await this.pool.query(query, [userId]);
        return result.rows;
    }

    async getBudgetsByCategory(userId: number, categoryId: number): Promise<IBudget[]> {
        const query = `
            SELECT 
                b.id, 
                b.user_id as "userId", 
                b.category_id as "categoryId", 
                b.amount_limit as "amountLimit",
                b.period,
                b.start_date as "startDate",
                b.end_date as "endDate",
                b.alert_threshold as "alertThreshold",
                b.status,
                b.created_at as "createdAt", 
                b.updated_at as "updatedAt"
            FROM budgets b
            WHERE b.user_id = $1 AND b.category_id = $2
            ORDER BY b.start_date DESC
        `;
        const result = await this.pool.query(query, [userId, categoryId]);
        return result.rows;
    }

    async getBudgetsByStatus(userId: number, status: string): Promise<IBudget[]> {
        const query = `
            SELECT 
                b.id, 
                b.user_id as "userId", 
                b.category_id as "categoryId", 
                b.amount_limit as "amountLimit",
                b.period,
                b.start_date as "startDate",
                b.end_date as "endDate",
                b.alert_threshold as "alertThreshold",
                b.status,
                b.created_at as "createdAt", 
                b.updated_at as "updatedAt"
            FROM budgets b
            WHERE b.user_id = $1 AND b.status = $2
            ORDER BY b.start_date DESC
        `;
        const result = await this.pool.query(query, [userId, status]);
        return result.rows;
    }

    async getBudgetById(id: number, userId: number): Promise<IBudget | null> {
        const query = `
            SELECT 
                b.id, 
                b.user_id as "userId", 
                b.category_id as "categoryId", 
                b.amount_limit as "amountLimit",
                b.period,
                b.start_date as "startDate",
                b.end_date as "endDate",
                b.alert_threshold as "alertThreshold",
                b.status,
                b.created_at as "createdAt", 
                b.updated_at as "updatedAt"
            FROM budgets b
            WHERE b.id = $1 AND b.user_id = $2
        `;
        const result = await this.pool.query(query, [id, userId]);
        return result.rows[0] || null;
    }

    async createBudget(userId: number, budgetData: IBudgetCreate): Promise<IBudget> {
        const query = `
            INSERT INTO budgets (
                user_id, 
                category_id, 
                amount_limit, 
                period,
                start_date, 
                end_date, 
                alert_threshold,
                status
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
            RETURNING 
                id, 
                user_id as "userId", 
                category_id as "categoryId", 
                amount_limit as "amountLimit",
                period,
                start_date as "startDate",
                end_date as "endDate",
                alert_threshold as "alertThreshold",
                status,
                created_at as "createdAt", 
                updated_at as "updatedAt"
        `;
        const result = await this.pool.query(query, [
            userId,
            budgetData.categoryId || null,
            budgetData.amountLimit,
            budgetData.period,
            budgetData.startDate,
            budgetData.endDate || null,
            budgetData.alertThreshold || null
        ]);
        return result.rows[0];
    }

    async updateBudget(id: number, userId: number, budgetData: IBudgetUpdate): Promise<IBudget | null> {
        // Primero obtenemos el presupuesto actual
        const currentBudget = await this.getBudgetById(id, userId);
        if (!currentBudget) return null;

        // Construimos la consulta de actualización
        const query = `
            UPDATE budgets
            SET 
                category_id = $1,
                amount_limit = $2,
                period = $3,
                start_date = $4,
                end_date = $5,
                alert_threshold = $6,
                status = $7,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $8 AND user_id = $9
            RETURNING 
                id, 
                user_id as "userId", 
                category_id as "categoryId", 
                amount_limit as "amountLimit",
                period,
                start_date as "startDate",
                end_date as "endDate",
                alert_threshold as "alertThreshold",
                status,
                created_at as "createdAt", 
                updated_at as "updatedAt"
        `;

        const result = await this.pool.query(query, [
            budgetData.categoryId !== undefined ? budgetData.categoryId : currentBudget.categoryId,
            budgetData.amountLimit !== undefined ? budgetData.amountLimit : currentBudget.amountLimit,
            budgetData.period !== undefined ? budgetData.period : currentBudget.period,
            budgetData.startDate !== undefined ? budgetData.startDate : currentBudget.startDate,
            budgetData.endDate !== undefined ? budgetData.endDate : currentBudget.endDate,
            budgetData.alertThreshold !== undefined ? budgetData.alertThreshold : currentBudget.alertThreshold,
            budgetData.status !== undefined ? budgetData.status : currentBudget.status,
            id,
            userId
        ]);

        return result.rows[0] || null;
    }

    async deleteBudget(id: number, userId: number): Promise<boolean> {
        const query = 'DELETE FROM budgets WHERE id = $1 AND user_id = $2 RETURNING id';
        const result = await this.pool.query(query, [id, userId]);
        return result.rowCount !== null && result.rowCount > 0;
    }

    async getCurrentSpendingByCategory(userId: number, categoryId: number, startDate: Date, endDate: Date): Promise<number> {
        // Esta función calcula el gasto actual para una categoría en un período específico
        const query = `
            SELECT SUM(m.amount) as "totalSpent"
            FROM movements m
            JOIN cards c ON m.card_id = c.id
            WHERE c.user_id = $1 
            AND m.category_id = $2
            AND m.movement_type = 'expense'
            AND m.transaction_date BETWEEN $3 AND $4
        `;
        const result = await this.pool.query(query, [userId, categoryId, startDate, endDate]);
        return result.rows[0]?.totalSpent || 0;
    }

    async getAllBudgetsWithSpending(userId: number): Promise<any[]> {
        // Obtenemos todos los presupuestos activos
        const budgets = await this.getBudgetsByStatus(userId, 'active');
        
        // Para cada presupuesto, calculamos el gasto actual
        const budgetsWithSpending = await Promise.all(
            budgets.map(async (budget) => {
                if (!budget.categoryId) return { ...budget, currentSpending: 0 };
                
                const currentSpending = await this.getCurrentSpendingByCategory(
                    userId,
                    budget.categoryId,
                    budget.startDate,
                    budget.endDate || new Date()
                );
                
                return {
                    ...budget,
                    currentSpending
                };
            })
        );
        
        return budgetsWithSpending;
    }
} 