import { Pool } from 'pg';
import { IProjectedMovement, IProjectedMovementCreate, IProjectedMovementUpdate, IProjectedMovementFilters } from '../interfaces/IProjectedMovement';
import { pool } from '../config/database/connection';

export class ProjectedMovementService {
    private pool: Pool;

    constructor() {
        this.pool = pool;
    }

    async getAllProjectedMovements(userId: number): Promise<IProjectedMovement[]> {
        const query = `
            SELECT 
                id, user_id as "userId", category_id as "categoryId",
                card_id as "cardId", amount, description,
                movement_type as "movementType", expected_date as "expectedDate",
                probability, status, actual_movement_id as "actualMovementId",
                recurrence_type as "recurrenceType",
                created_at as "createdAt", updated_at as "updatedAt"
            FROM projected_movements
            WHERE user_id = $1
            ORDER BY expected_date DESC
        `;
        const result = await this.pool.query(query, [userId]);
        return result.rows;
    }

    async getProjectedMovementById(id: number, userId: number): Promise<IProjectedMovement | null> {
        const query = `
            SELECT 
                id, user_id as "userId", category_id as "categoryId",
                card_id as "cardId", amount, description,
                movement_type as "movementType", expected_date as "expectedDate",
                probability, status, actual_movement_id as "actualMovementId",
                recurrence_type as "recurrenceType",
                created_at as "createdAt", updated_at as "updatedAt"
            FROM projected_movements
            WHERE id = $1 AND user_id = $2
        `;
        const result = await this.pool.query(query, [id, userId]);
        return result.rows[0] || null;
    }

    async getProjectedMovementsByFilters(filters: IProjectedMovementFilters): Promise<IProjectedMovement[]> {
        const conditions: string[] = ['user_id = $1'];
        const values: any[] = [filters.userId];
        let paramCount = 1;

        if (filters.categoryId) {
            paramCount++;
            conditions.push(`category_id = $${paramCount}`);
            values.push(filters.categoryId);
        }

        if (filters.cardId) {
            paramCount++;
            conditions.push(`card_id = $${paramCount}`);
            values.push(filters.cardId);
        }

        if (filters.movementType) {
            paramCount++;
            conditions.push(`movement_type = $${paramCount}`);
            values.push(filters.movementType);
        }

        if (filters.startDate) {
            paramCount++;
            conditions.push(`expected_date >= $${paramCount}`);
            values.push(filters.startDate);
        }

        if (filters.endDate) {
            paramCount++;
            conditions.push(`expected_date <= $${paramCount}`);
            values.push(filters.endDate);
        }

        if (filters.minAmount) {
            paramCount++;
            conditions.push(`amount >= $${paramCount}`);
            values.push(filters.minAmount);
        }

        if (filters.maxAmount) {
            paramCount++;
            conditions.push(`amount <= $${paramCount}`);
            values.push(filters.maxAmount);
        }

        if (filters.minProbability) {
            paramCount++;
            conditions.push(`probability >= $${paramCount}`);
            values.push(filters.minProbability);
        }

        if (filters.maxProbability) {
            paramCount++;
            conditions.push(`probability <= $${paramCount}`);
            values.push(filters.maxProbability);
        }

        if (filters.status) {
            paramCount++;
            conditions.push(`status = $${paramCount}`);
            values.push(filters.status);
        }

        if (filters.recurrenceType) {
            paramCount++;
            conditions.push(`recurrence_type = $${paramCount}`);
            values.push(filters.recurrenceType);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const query = `
            SELECT 
                id, user_id as "userId", category_id as "categoryId",
                card_id as "cardId", amount, description,
                movement_type as "movementType", expected_date as "expectedDate",
                probability, status, actual_movement_id as "actualMovementId",
                recurrence_type as "recurrenceType",
                created_at as "createdAt", updated_at as "updatedAt"
            FROM projected_movements
            ${whereClause}
            ORDER BY expected_date DESC
        `;

        const result = await this.pool.query(query, values);
        return result.rows;
    }

    async createProjectedMovement(movementData: IProjectedMovementCreate): Promise<IProjectedMovement> {
        const query = `
            INSERT INTO projected_movements (
                user_id, category_id, card_id, amount,
                description, movement_type, expected_date,
                probability, recurrence_type, status
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending'
            )
            RETURNING 
                id, user_id as "userId", category_id as "categoryId",
                card_id as "cardId", amount, description,
                movement_type as "movementType", expected_date as "expectedDate",
                probability, status, actual_movement_id as "actualMovementId",
                recurrence_type as "recurrenceType",
                created_at as "createdAt", updated_at as "updatedAt"
        `;

        const result = await this.pool.query(query, [
            movementData.userId,
            movementData.categoryId,
            movementData.cardId,
            movementData.amount,
            movementData.description,
            movementData.movementType,
            movementData.expectedDate,
            movementData.probability || 100,
            movementData.recurrenceType
        ]);

        return result.rows[0];
    }

    async updateProjectedMovement(
        id: number, 
        userId: number, 
        movementData: IProjectedMovementUpdate
    ): Promise<IProjectedMovement | null> {
        const currentMovement = await this.getProjectedMovementById(id, userId);
        if (!currentMovement) return null;

        const updateFields: string[] = [];
        const values: any[] = [];
        let paramCount = 0;

        // Construir dinámicamente la consulta de actualización
        const updateData: Record<string, any> = {
            category_id: movementData.categoryId,
            card_id: movementData.cardId,
            amount: movementData.amount,
            description: movementData.description,
            movement_type: movementData.movementType,
            expected_date: movementData.expectedDate,
            probability: movementData.probability,
            status: movementData.status,
            actual_movement_id: movementData.actualMovementId,
            recurrence_type: movementData.recurrenceType
        };

        for (const [key, value] of Object.entries(updateData)) {
            if (value !== undefined) {
                paramCount++;
                updateFields.push(`${key} = $${paramCount}`);
                values.push(value);
            }
        }

        if (updateFields.length === 0) return currentMovement;

        // Agregar updated_at
        updateFields.push('updated_at = CURRENT_TIMESTAMP');

        // Agregar id y userId para el WHERE
        paramCount++;
        values.push(id);
        paramCount++;
        values.push(userId);

        const query = `
            UPDATE projected_movements
            SET ${updateFields.join(', ')}
            WHERE id = $${paramCount - 1} AND user_id = $${paramCount}
            RETURNING 
                id, user_id as "userId", category_id as "categoryId",
                card_id as "cardId", amount, description,
                movement_type as "movementType", expected_date as "expectedDate",
                probability, status, actual_movement_id as "actualMovementId",
                recurrence_type as "recurrenceType",
                created_at as "createdAt", updated_at as "updatedAt"
        `;

        const result = await this.pool.query(query, values);
        return result.rows[0];
    }

    async deleteProjectedMovement(id: number, userId: number): Promise<boolean> {
        const query = 'DELETE FROM projected_movements WHERE id = $1 AND user_id = $2 RETURNING id';
        const result = await this.pool.query(query, [id, userId]);
        return result.rowCount !== null && result.rowCount > 0;
    }
} 