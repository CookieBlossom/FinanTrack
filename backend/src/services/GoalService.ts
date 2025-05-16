import { Pool } from 'pg';
import { IGoal, IGoalCreate, IGoalUpdate } from '../interfaces/IGoal';
import { pool } from '../config/database/connection';

export class GoalService {
    private pool: Pool;

    constructor() {
        this.pool = pool;
    }

    async getAllGoalsByUserId(userId: number): Promise<IGoal[]> {
        const query = `
            SELECT 
                g.id, 
                g.user_id as "userId", 
                g.category_id as "categoryId", 
                g.amount_expected as "amountExpected",
                g.amount_actual as "amountActual",
                g.goal_period as "goalPeriod",
                g.deadline,
                g.goal_description as "goalDescription",
                g.created_at as "createdAt", 
                g.updated_at as "updatedAt"
            FROM goals g
            WHERE g.user_id = $1
            ORDER BY g.deadline ASC
        `;
        const result = await this.pool.query(query, [userId]);
        return result.rows;
    }

    async getGoalsByCategory(userId: number, categoryId: number): Promise<IGoal[]> {
        const query = `
            SELECT 
                g.id, 
                g.user_id as "userId", 
                g.category_id as "categoryId", 
                g.amount_expected as "amountExpected",
                g.amount_actual as "amountActual",
                g.goal_period as "goalPeriod",
                g.deadline,
                g.goal_description as "goalDescription",
                g.created_at as "createdAt", 
                g.updated_at as "updatedAt"
            FROM goals g
            WHERE g.user_id = $1 AND g.category_id = $2
            ORDER BY g.deadline ASC
        `;
        const result = await this.pool.query(query, [userId, categoryId]);
        return result.rows;
    }

    async getGoalById(id: number, userId: number): Promise<IGoal | null> {
        const query = `
            SELECT 
                g.id, 
                g.user_id as "userId", 
                g.category_id as "categoryId", 
                g.amount_expected as "amountExpected",
                g.amount_actual as "amountActual",
                g.goal_period as "goalPeriod",
                g.deadline,
                g.goal_description as "goalDescription",
                g.created_at as "createdAt", 
                g.updated_at as "updatedAt"
            FROM goals g
            WHERE g.id = $1 AND g.user_id = $2
        `;
        const result = await this.pool.query(query, [id, userId]);
        return result.rows[0] || null;
    }

    async createGoal(userId: number, goalData: IGoalCreate): Promise<IGoal> {
        const query = `
            INSERT INTO goals (
                user_id, 
                category_id, 
                amount_expected, 
                amount_actual,
                goal_period, 
                deadline, 
                goal_description
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING 
                id, 
                user_id as "userId", 
                category_id as "categoryId", 
                amount_expected as "amountExpected",
                amount_actual as "amountActual",
                goal_period as "goalPeriod",
                deadline,
                goal_description as "goalDescription",
                created_at as "createdAt", 
                updated_at as "updatedAt"
        `;
        const result = await this.pool.query(query, [
            userId,
            goalData.categoryId,
            goalData.amountExpected,
            0, // Valor inicial para amountActual
            goalData.goalPeriod,
            goalData.deadline,
            goalData.goalDescription || null
        ]);
        return result.rows[0];
    }

    async updateGoal(id: number, userId: number, goalData: IGoalUpdate): Promise<IGoal | null> {
        // Primero obtenemos el objetivo actual
        const currentGoal = await this.getGoalById(id, userId);
        if (!currentGoal) return null;

        // Construimos la consulta de actualización
        const query = `
            UPDATE goals
            SET 
                category_id = $1,
                amount_expected = $2,
                amount_actual = $3,
                goal_period = $4,
                deadline = $5,
                goal_description = $6,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $7 AND user_id = $8
            RETURNING 
                id, 
                user_id as "userId", 
                category_id as "categoryId", 
                amount_expected as "amountExpected",
                amount_actual as "amountActual",
                goal_period as "goalPeriod",
                deadline,
                goal_description as "goalDescription",
                created_at as "createdAt", 
                updated_at as "updatedAt"
        `;

        const result = await this.pool.query(query, [
            goalData.categoryId !== undefined ? goalData.categoryId : currentGoal.categoryId,
            goalData.amountExpected !== undefined ? goalData.amountExpected : currentGoal.amountExpected,
            goalData.amountActual !== undefined ? goalData.amountActual : currentGoal.amountActual,
            goalData.goalPeriod !== undefined ? goalData.goalPeriod : currentGoal.goalPeriod,
            goalData.deadline !== undefined ? goalData.deadline : currentGoal.deadline,
            goalData.goalDescription !== undefined ? goalData.goalDescription : currentGoal.goalDescription,
            id,
            userId
        ]);

        return result.rows[0] || null;
    }

    async deleteGoal(id: number, userId: number): Promise<boolean> {
        const query = 'DELETE FROM goals WHERE id = $1 AND user_id = $2 RETURNING id';
        const result = await this.pool.query(query, [id, userId]);
        return result.rowCount !== null && result.rowCount > 0;
    }

    async updateGoalProgress(id: number, userId: number, newAmount: number): Promise<IGoal | null> {
        // Actualizamos solo el progreso del objetivo
        const query = `
            UPDATE goals
            SET 
                amount_actual = $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2 AND user_id = $3
            RETURNING 
                id, 
                user_id as "userId", 
                category_id as "categoryId", 
                amount_expected as "amountExpected",
                amount_actual as "amountActual",
                goal_period as "goalPeriod",
                deadline,
                goal_description as "goalDescription",
                created_at as "createdAt", 
                updated_at as "updatedAt"
        `;

        const result = await this.pool.query(query, [newAmount, id, userId]);
        return result.rows[0] || null;
    }
} 