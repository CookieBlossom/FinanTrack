import {Pool } from 'pg';
import { IProjectedMovement, IProjectedMovementCreate, IProjectedMovementUpdate, IProjectedMovementFilters } from '../interfaces/IProjectedMovement';
import { pool } from '../config/database/connection';
import { PlanService } from './plan.service';
import { DatabaseError } from '../utils/errors';
export class ProjectedMovementService {
    private pool: Pool;
    private planService: PlanService;

    constructor() {
        this.pool = pool;
        this.planService = new PlanService();
    }
    async countProjectedByUser(userId: number): Promise<number> {
        const res = await this.pool.query(
          `SELECT COUNT(*) AS cnt FROM projected_movements WHERE user_id = $1`,
          [userId]
        );
        return Number(res.rows[0].cnt);
      }
    async getAllProjectedMovements(userId: number): Promise<IProjectedMovement[]> {
        const query = `
            SELECT 
                pm.id, pm.user_id as "userId", pm.category_id as "categoryId",
                pm.card_id as "cardId", pm.amount, pm.description,
                pm.movement_type as "movementType", pm.expected_date as "expectedDate",
                pm.probability, pm.status, pm.actual_movement_id as "actualMovementId",
                pm.recurrence_type as "recurrenceType",
                pm.created_at as "createdAt", pm.updated_at as "updatedAt",
                -- Datos de la categoría
                c.id as "category.id",
                c.name_category as "category.nameCategory",
                c.color as "category.color",
                -- Datos de la tarjeta
                card.id as "card.id",
                card.name_account as "card.nameAccount",
                card.alias_account as "card.aliasAccount"
            FROM projected_movements pm
            LEFT JOIN categories c ON pm.category_id = c.id
            LEFT JOIN cards card ON pm.card_id = card.id
            WHERE pm.user_id = $1
            ORDER BY pm.expected_date DESC
        `;
        const result = await this.pool.query(query, [userId]);
        
        // Transformar los resultados para que coincidan con la estructura esperada
        return result.rows.map(row => ({
            id: row.id,
            userId: row.userId,
            categoryId: row.categoryId,
            cardId: row.cardId,
            amount: row.amount,
            description: row.description,
            movementType: row.movementType,
            expectedDate: row.expectedDate,
            probability: row.probability,
            status: row.status,
            actualMovementId: row.actualMovementId,
            recurrenceType: row.recurrenceType,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            // Datos expandidos de categoría
            category: row['category.id'] ? {
                id: row['category.id'],
                nameCategory: row['category.nameCategory'],
                color: row['category.color']
            } : undefined,
            // Datos expandidos de tarjeta
            card: row['card.id'] ? {
                id: row['card.id'],
                nameAccount: row['card.nameAccount'],
                aliasAccount: row['card.aliasAccount']
            } : undefined
        }));
    }

    async getProjectedMovementById(id: number, userId: number): Promise<IProjectedMovement | null> {
        const query = `
            SELECT 
                pm.id, pm.user_id as "userId", pm.category_id as "categoryId",
                pm.card_id as "cardId", pm.amount, pm.description,
                pm.movement_type as "movementType", pm.expected_date as "expectedDate",
                pm.probability, pm.status, pm.actual_movement_id as "actualMovementId",
                pm.recurrence_type as "recurrenceType",
                pm.created_at as "createdAt", pm.updated_at as "updatedAt",
                c.id as "category.id",
                c.name_category as "category.nameCategory",
                c.color as "category.color",
                card.id as "card.id",
                card.name_account as "card.nameAccount",
                card.alias_account as "card.aliasAccount"
            FROM projected_movements pm
            LEFT JOIN categories c ON pm.category_id = c.id
            LEFT JOIN cards card ON pm.card_id = card.id
            WHERE pm.id = $1 AND pm.user_id = $2
        `;
        const result = await this.pool.query(query, [id, userId]);
        
        if (!result.rows[0]) return null;
        
        const row = result.rows[0];
        return {
            id: row.id,
            userId: row.userId,
            categoryId: row.categoryId,
            cardId: row.cardId,
            amount: row.amount,
            description: row.description,
            movementType: row.movementType,
            expectedDate: row.expectedDate,
            probability: row.probability,
            status: row.status,
            actualMovementId: row.actualMovementId,
            recurrenceType: row.recurrenceType,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            // Datos expandidos de categoría
            category: row['category.id'] ? {
                id: row['category.id'],
                nameCategory: row['category.nameCategory'],
                color: row['category.color']
            } : undefined,
            // Datos expandidos de tarjeta
            card: row['card.id'] ? {
                id: row['card.id'],
                nameAccount: row['card.nameAccount'],
                aliasAccount: row['card.aliasAccount']
            } : undefined
        };
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
                pm.id, pm.user_id as "userId", pm.category_id as "categoryId",
                pm.card_id as "cardId", pm.amount, pm.description,
                pm.movement_type as "movementType", pm.expected_date as "expectedDate",
                pm.probability, pm.status, pm.actual_movement_id as "actualMovementId",
                pm.recurrence_type as "recurrenceType",
                pm.created_at as "createdAt", pm.updated_at as "updatedAt",
                -- Datos de la categoría
                c.id as "category.id",
                c.name_category as "category.nameCategory",
                c.color as "category.color",
                -- Datos de la tarjeta
                card.id as "card.id",
                card.name_account as "card.nameAccount",
                card.alias_account as "card.aliasAccount"
            FROM projected_movements pm
            LEFT JOIN categories c ON pm.category_id = c.id
            LEFT JOIN cards card ON pm.card_id = card.id
            ${whereClause}
            ORDER BY pm.expected_date DESC
        `;

        const result = await this.pool.query(query, values);
        
        // Transformar los resultados para que coincidan con la estructura esperada
        return result.rows.map(row => ({
            id: row.id,
            userId: row.userId,
            categoryId: row.categoryId,
            cardId: row.cardId,
            amount: row.amount,
            description: row.description,
            movementType: row.movementType,
            expectedDate: row.expectedDate,
            probability: row.probability,
            status: row.status,
            actualMovementId: row.actualMovementId,
            recurrenceType: row.recurrenceType,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            // Datos expandidos de categoría
            category: row['category.id'] ? {
                id: row['category.id'],
                nameCategory: row['category.nameCategory'],
                color: row['category.color']
            } : undefined,
            // Datos expandidos de tarjeta
            card: row['card.id'] ? {
                id: row['card.id'],
                nameAccount: row['card.nameAccount'],
                aliasAccount: row['card.aliasAccount']
            } : undefined
        }));
    }
    async createProjectedMovement(params: {
        userId: number;
        planId: number;
        categoryId?: number;
        cardId?: number;
        amount: number;
        description?: string;
        movementType: 'income' | 'expense';
        expectedDate: Date;
        probability?: number;
        recurrenceType?: 'monthly' | 'yearly' | 'weekly' | null;
      }): Promise<IProjectedMovementCreate> {
        const {
          userId,
          planId,
          categoryId = null,
          cardId = null,
          amount,
          description = null,
          movementType,
          expectedDate,
          probability = 100,
          recurrenceType = null
        } = params;
    
        try {
          const limits = await this.planService.getLimitsForPlan(planId);
          if (limits.projected_moves !== -1) {
            const used = await this.countProjectedByUser(userId);
            if (used >= limits.projected_moves) {
              throw new DatabaseError(
                `Has alcanzado el límite de ${limits.projected_moves} movimientos proyectados para tu plan`
              );
            }
          }
        } catch (error) {
            if (error instanceof DatabaseError) {
                throw error;
            }
            throw new DatabaseError('Error al obtener los límites del plan');
        }
        
        const query = `
          INSERT INTO projected_movements (
            user_id, category_id, card_id, amount,
            description, movement_type, expected_date,
            probability, recurrence_type, status
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending'
          )
          RETURNING
            id, user_id AS "userId", category_id AS "categoryId",
            card_id AS "cardId", amount, description,
            movement_type AS "movementType", expected_date AS "expectedDate",
            probability, status, actual_movement_id AS "actualMovementId",
            recurrence_type AS "recurrenceType", created_at AS "createdAt", updated_at AS "updatedAt"
        `;
    
        const values = [userId, categoryId, cardId, amount, description, movementType, expectedDate, probability, recurrenceType];
        const result = await this.pool.query(query, values);
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