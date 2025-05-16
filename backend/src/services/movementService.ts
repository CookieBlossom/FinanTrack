import { Pool } from 'pg';
import { IMovement, IMovementCreate, IMovementUpdate, IMovementFilters } from '../interfaces/IMovement';
import { pool } from '../config/database/connection';

export class MovementService {
    private pool: Pool;

    constructor() {
        this.pool = pool;
    }

    private buildWhereClause(filters: IMovementFilters): { whereClause: string; values: any[] } {
        const conditions: string[] = [];
        const values: any[] = [];
        let paramCount = 1;

        if (filters.cardId) {
            conditions.push(`card_id = $${paramCount}`);
            values.push(filters.cardId);
            paramCount++;
        }

        if (filters.categoryId) {
            conditions.push(`category_id = $${paramCount}`);
            values.push(filters.categoryId);
            paramCount++;
        }

        if (filters.movementType) {
            conditions.push(`movement_type = $${paramCount}`);
            values.push(filters.movementType);
            paramCount++;
        }

        if (filters.movementSource) {
            conditions.push(`movement_source = $${paramCount}`);
            values.push(filters.movementSource);
            paramCount++;
        }

        if (filters.startDate) {
            conditions.push(`transaction_date >= $${paramCount}`);
            values.push(filters.startDate);
            paramCount++;
        }

        if (filters.endDate) {
            conditions.push(`transaction_date <= $${paramCount}`);
            values.push(filters.endDate);
            paramCount++;
        }

        if (filters.minAmount) {
            conditions.push(`amount >= $${paramCount}`);
            values.push(filters.minAmount);
            paramCount++;
        }

        if (filters.maxAmount) {
            conditions.push(`amount <= $${paramCount}`);
            values.push(filters.maxAmount);
            paramCount++;
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        return { whereClause, values };
    }

    async getAllMovements(): Promise<IMovement[]> {
        const query = `
            SELECT 
                id, card_id as "cardId", category_id as "categoryId",
                amount, description, movement_type as "movementType",
                movement_source as "movementSource", transaction_date as "transactionDate",
                created_at as "createdAt", updated_at as "updatedAt",
                metadata
            FROM movements
            ORDER BY transaction_date DESC
        `;
        const result = await this.pool.query(query);
        return result.rows;
    }

    async getMovementById(id: number): Promise<IMovement | null> {
        const query = `
            SELECT 
                id, card_id as "cardId", category_id as "categoryId",
                amount, description, movement_type as "movementType",
                movement_source as "movementSource", transaction_date as "transactionDate",
                created_at as "createdAt", updated_at as "updatedAt",
                metadata
            FROM movements
            WHERE id = $1
        `;
        const result = await this.pool.query(query, [id]);
        return result.rows[0] || null;
    }

    async getMovementsByFilters(filters: IMovementFilters): Promise<IMovement[]> {
        const { whereClause, values } = this.buildWhereClause(filters);
        const query = `
            SELECT 
                id, card_id as "cardId", category_id as "categoryId",
                amount, description, movement_type as "movementType",
                movement_source as "movementSource", transaction_date as "transactionDate",
                created_at as "createdAt", updated_at as "updatedAt",
                metadata
            FROM movements
            ${whereClause}
            ORDER BY transaction_date DESC
        `;
        const result = await this.pool.query(query, values);
        return result.rows;
    }

    async createMovement(movementData: IMovementCreate): Promise<IMovement> {
        const query = `
            INSERT INTO movements (
                card_id, category_id, amount, description,
                movement_type, movement_source, transaction_date,
                metadata
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8
            )
            RETURNING 
                id, card_id as "cardId", category_id as "categoryId",
                amount, description, movement_type as "movementType",
                movement_source as "movementSource", transaction_date as "transactionDate",
                created_at as "createdAt", updated_at as "updatedAt",
                metadata
        `;
        const result = await this.pool.query(query, [
            movementData.cardId,
            movementData.categoryId,
            movementData.amount,
            movementData.description,
            movementData.movementType,
            movementData.movementSource,
            movementData.transactionDate,
            movementData.metadata
        ]);
        return result.rows[0];
    }

    async updateMovement(id: number, movementData: IMovementUpdate): Promise<IMovement | null> {
        const currentMovement = await this.getMovementById(id);
        if (!currentMovement) return null;

        const query = `
            UPDATE movements
            SET 
                card_id = $1,
                category_id = $2,
                amount = $3,
                description = $4,
                movement_type = $5,
                movement_source = $6,
                transaction_date = $7,
                metadata = $8,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $9
            RETURNING 
                id, card_id as "cardId", category_id as "categoryId",
                amount, description, movement_type as "movementType",
                movement_source as "movementSource", transaction_date as "transactionDate",
                created_at as "createdAt", updated_at as "updatedAt",
                metadata
        `;
        const result = await this.pool.query(query, [
            movementData.cardId || currentMovement.cardId,
            movementData.categoryId || currentMovement.categoryId,
            movementData.amount || currentMovement.amount,
            movementData.description || currentMovement.description,
            movementData.movementType || currentMovement.movementType,
            movementData.movementSource || currentMovement.movementSource,
            movementData.transactionDate || currentMovement.transactionDate,
            movementData.metadata || currentMovement.metadata,
            id
        ]);
        return result.rows[0];
    }

    async deleteMovement(id: number): Promise<boolean> {
        const query = 'DELETE FROM movements WHERE id = $1 RETURNING id';
        const result = await this.pool.query(query, [id]);
        return result.rowCount !== null && result.rowCount > 0;
    }
} 