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
        // Verificar que el usuario existe y está activo
        const userQuery = 'SELECT id FROM "user" WHERE id = $1 AND is_active = true AND deleted_at IS NULL';
        const userResult = await this.pool.query(userQuery, [userId]);
        
        if (userResult.rows.length === 0) {
            throw new DatabaseError('Usuario no encontrado o inactivo');
        }

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
                card.account_holder as "card.accountHolder"
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
                accountHolder: row['card.accountHolder']
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
                card.account_holder as "card.accountHolder"
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
                accountHolder: row['card.accountHolder']
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
                card.account_holder as "card.accountHolder"
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
                accountHolder: row['card.accountHolder']
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
          // Verificar límites solo si no es ilimitado (-1)
          if (limits.projected_movements !== undefined && limits.projected_movements !== -1) {
            const used = await this.countProjectedByUser(userId);
            if (used >= limits.projected_movements) {
              throw new DatabaseError(
                `Has alcanzado el límite de ${limits.projected_movements} movimientos proyectados para tu plan`
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

    /**
     * Obtiene movimientos proyectados de manera inteligente:
     * 1. Si hay movimientos proyectados, usa esos
     * 2. Si no hay proyectados pero hay movimientos reales, genera proyecciones automáticas
     * 3. Si no hay datos, retorna array vacío
     */
    async getIntelligentProjectedMovements(userId: number): Promise<IProjectedMovement[]> {
        try {
            // PRIORIDAD 1: Verificar si hay movimientos proyectados existentes
            const existingProjections = await this.getAllProjectedMovements(userId);
            
            if (existingProjections.length > 0) {
                return existingProjections;
            }

            // PRIORIDAD 2: Verificar si hay movimientos reales para generar proyecciones automáticas
            const hasRealMovements = await this.checkRealMovements(userId);
            
            if (hasRealMovements) {
                return await this.generateAutoProjectedMovements(userId);
            }

            // PRIORIDAD 3: No hay datos
            return [];

        } catch (error) {
            console.error('Error al obtener movimientos proyectados inteligentes:', error);
            return [];
        }
    }

    /**
     * Verifica si el usuario tiene movimientos reales
     */
    private async checkRealMovements(userId: number): Promise<boolean> {
        const query = `
            SELECT COUNT(*) as count
            FROM movements m
            JOIN cards c ON m.card_id = c.id
            WHERE c.user_id = $1
            AND m.transaction_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '3 months')
        `;
        
        const result = await this.pool.query(query, [userId]);
        return parseInt(result.rows[0].count) > 0;
    }

    /**
     * Genera movimientos proyectados automáticamente basándose en el historial
     */
    private async generateAutoProjectedMovements(userId: number): Promise<IProjectedMovement[]> {
        try {
            // Obtener patrones de movimientos de los últimos 3 meses
            const patternsQuery = `
                SELECT 
                    mov.movement_type as "movementType",
                    mov.category_id as "categoryId",
                    mov.card_id as "cardId",
                    cat.name_category as "categoryName",
                    cat.color as "categoryColor",
                    card.name_account as "cardName",
                    card.account_holder as "cardHolder",
                    AVG(ABS(mov.amount)) as "avgAmount",
                    COUNT(*) as frequency,
                    MAX(mov.description) as "sampleDescription"
                FROM movements mov
                JOIN cards card ON mov.card_id = card.id
                LEFT JOIN categories cat ON mov.category_id = cat.id
                WHERE card.user_id = $1
                AND mov.transaction_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '3 months')
                AND mov.transaction_date < DATE_TRUNC('month', CURRENT_DATE)
                GROUP BY mov.movement_type, mov.category_id, mov.card_id, cat.name_category, cat.color, card.name_account, card.account_holder
                HAVING COUNT(*) >= 2
                ORDER BY frequency DESC, "avgAmount" DESC
            `;

            const result = await this.pool.query(patternsQuery, [userId]);

            if (result.rows.length === 0) {
                return [];
            }

            // Generar proyecciones para los próximos 3 meses
            const projectedMovements: IProjectedMovement[] = [];
            const baseDate = new Date();
            baseDate.setMonth(baseDate.getMonth() + 1);
            baseDate.setDate(1); // Primer día del próximo mes

            for (const pattern of result.rows) {
                const avgAmount = parseFloat(pattern.avgAmount);
                const frequency = parseInt(pattern.frequency);
                
                // Calcular probabilidad basada en la frecuencia
                const probability = Math.min(Math.round((frequency / 3) * 100), 95);
                
                // Determinar si es recurrente (más de 4 movimientos en 3 meses)
                const isRecurrent = frequency >= 4;
                const recurrenceType = isRecurrent ? 'monthly' : null;

                // Generar descripción automática
                const description = pattern.sampleDescription || 
                    `Proyección automática - ${pattern.categoryName || 'Otros'}`;

                // Crear proyección para los próximos 1-3 meses
                const monthsToProject = isRecurrent ? 3 : 1;
                
                for (let i = 0; i < monthsToProject; i++) {
                    const projectionDate = new Date(baseDate);
                    projectionDate.setMonth(projectionDate.getMonth() + i);
                    
                    // Agregar algunos días aleatorios para que no todos caigan el día 1
                    const randomDay = Math.floor(Math.random() * 25) + 1;
                    projectionDate.setDate(randomDay);

                    const projection: IProjectedMovement = {
                        id: -(projectedMovements.length + 1), // ID temporal negativo para diferenciar
                        userId: userId,
                        categoryId: pattern.categoryId ?? undefined,
                        cardId: pattern.cardId ?? undefined,
                        amount: Math.round(avgAmount),
                        description: `[Auto] ${description}`,
                        movementType: pattern.movementType,
                        expectedDate: projectionDate,
                        probability: probability,
                        status: 'pending',
                        actualMovementId: undefined,
                        recurrenceType: recurrenceType,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        // Datos expandidos
                        category: pattern.categoryId ? {
                            id: pattern.categoryId,
                            nameCategory: pattern.categoryName,
                            color: pattern.categoryColor || '#9E9E9E'
                        } : undefined,
                        card: pattern.cardId ? {
                            id: pattern.cardId,
                            nameAccount: pattern.cardName,
                            accountHolder: pattern.cardHolder
                        } : undefined
                    };

                    projectedMovements.push(projection);
                }
            }

            return projectedMovements.slice(0, 20); // Limitar a 20 proyecciones

        } catch (error) {
            console.error('Error al generar proyecciones automáticas:', error);
            return [];
        }
    }

    private getProjectedMovementSelectFields(): string {
        return `
          pm.id,
          pm.user_id as "userId",
          pm.category_id as "categoryId",
          pm.card_id as "cardId",
          pm.amount,
          pm.description,
          pm.movement_type as "movementType",
          pm.expected_date as "expectedDate",
          pm.probability,
          pm.status,
          pm.actual_movement_id as "actualMovementId",
          pm.recurrence_type as "recurrenceType",
          pm.is_recurrent as "isRecurrent",
          pm.created_at as "createdAt",
          pm.updated_at as "updatedAt",
          card.name_account as "card.nameAccount",
          card.account_holder as "card.accountHolder",
          card.balance as "card.balance",
          card.balance_source as "card.balanceSource",
          card.last_balance_update as "card.lastBalanceUpdate",
          card.status_account as "card.statusAccount",
          card.source as "card.source",
          card.card_type_id as "card.cardTypeId",
          card.bank_id as "card.bankId",
          card.created_at as "card.createdAt",
          card.updated_at as "card.updatedAt",
          category.name_category as "category.nameCategory",
          category.color as "category.color",
          category.is_system as "category.isSystem",
          category.created_at as "category.createdAt",
          category.updated_at as "category.updatedAt"
        `;
      }
} 