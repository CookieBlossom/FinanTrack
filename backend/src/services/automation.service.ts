import { Pool } from 'pg';
import { pool } from '../config/database/connection';
import { ProjectedMovementService } from './projectedMovement.service';
import { MovementService } from './movement.service';
import { DatabaseError } from '../utils/errors';

export class AutomationService {
    private pool: Pool;
    private projectedMovementService: ProjectedMovementService;
    private movementService: MovementService;

    constructor() {
        this.pool = pool;
        this.projectedMovementService = new ProjectedMovementService();
        this.movementService = new MovementService();
    }

    /**
     * Procesa automáticamente los movimientos proyectados vencidos
     * Convierte movimientos con alta probabilidad en movimientos reales
     */
    async processOverdueProjectedMovements(): Promise<{
        processed: number;
        skipped: number;
        errors: number;
        details: Array<{
            projectedId: number;
            userId: number;
            status: 'processed' | 'skipped' | 'error';
            message?: string;
        }>;
    }> {
        const result = {
            processed: 0,
            skipped: 0,
            errors: 0,
            details: [] as Array<{
                projectedId: number;
                userId: number;
                status: 'processed' | 'skipped' | 'error';
                message?: string;
            }>
        };

        try {
            // Obtener movimientos proyectados vencidos con alta probabilidad
            const overdueMovements = await this.getOverdueHighProbabilityMovements();

            for (const movement of overdueMovements) {
                try {
                    const shouldProcess = await this.shouldProcessMovement(movement);
                    
                    if (shouldProcess) {
                        await this.convertToRealMovement(movement);
                        result.processed++;
                        result.details.push({
                            projectedId: movement.id!,
                            userId: movement.userId,
                            status: 'processed',
                            message: 'Movimiento convertido automáticamente'
                        });
                    } else {
                        result.skipped++;
                        result.details.push({
                            projectedId: movement.id!,
                            userId: movement.userId,
                            status: 'skipped',
                            message: 'No cumple criterios para conversión automática'
                        });
                    }
                } catch (error) {
                    result.errors++;
                    result.details.push({
                        projectedId: movement.id!,
                        userId: movement.userId,
                        status: 'error',
                        message: error instanceof Error ? error.message : 'Error desconocido'
                    });
                    console.error(`Error procesando movimiento ${movement.id}:`, error);
                }
            }
        } catch (error) {
            console.error('Error en procesamiento automático:', error);
            throw new DatabaseError('Error al procesar movimientos proyectados automáticamente');
        }

        return result;
    }

    /**
     * Obtiene movimientos proyectados vencidos con alta probabilidad
     */
    private async getOverdueHighProbabilityMovements(): Promise<any[]> {
        const query = `
            SELECT 
                pm.id, pm.user_id as "userId", pm.category_id as "categoryId",
                pm.card_id as "cardId", pm.amount, pm.description,
                pm.movement_type as "movementType", pm.expected_date as "expectedDate",
                pm.probability, pm.status, pm.recurrence_type as "recurrenceType",
                c.name_category as "categoryName",
                card.name_account as "cardName"
            FROM projected_movements pm
            LEFT JOIN categories c ON pm.category_id = c.id
            LEFT JOIN cards card ON pm.card_id = card.id
            WHERE pm.status = 'pending'
                AND pm.expected_date < CURRENT_DATE
                AND pm.probability >= 75
                AND (pm.recurrence_type IS NULL OR pm.recurrence_type != 'monthly')
            ORDER BY pm.expected_date ASC, pm.probability DESC
        `;

        const result = await this.pool.query(query);
        return result.rows;
    }

    /**
     * Determina si un movimiento debe ser procesado automáticamente
     */
    private async shouldProcessMovement(movement: any): Promise<boolean> {
        // Verificar si ya existe un movimiento real para esta fecha y descripción
        const existingMovement = await this.checkExistingMovement(movement);
        if (existingMovement) {
            return false;
        }

        // Verificar si el movimiento es recurrente y ya se procesó recientemente
        if (movement.recurrenceType) {
            const lastProcessed = await this.getLastProcessedRecurringMovement(movement);
            if (lastProcessed) {
                return false;
            }
        }

        return true;
    }

    /**
     * Verifica si ya existe un movimiento real similar
     */
    private async checkExistingMovement(movement: any): Promise<boolean> {
        const query = `
            SELECT COUNT(*) as count
            FROM movements
            WHERE card_id = $1
                AND amount = $2
                AND movement_type = $3
                AND DATE(transaction_date) = $4
                AND description ILIKE $5
        `;

        const result = await this.pool.query(query, [
            movement.cardId || 1,
            movement.amount,
            movement.movementType,
            movement.expectedDate,
            `%${movement.description || ''}%`
        ]);

        return parseInt(result.rows[0].count) > 0;
    }

    /**
     * Obtiene el último movimiento recurrente procesado
     */
    private async getLastProcessedRecurringMovement(movement: any): Promise<any> {
        const query = `
            SELECT actual_movement_id
            FROM projected_movements
            WHERE user_id = $1
                AND description = $2
                AND amount = $3
                AND movement_type = $4
                AND recurrence_type = $5
                AND status = 'completed'
                AND actual_movement_id IS NOT NULL
            ORDER BY expected_date DESC
            LIMIT 1
        `;

        const result = await this.pool.query(query, [
            movement.userId,
            movement.description,
            movement.amount,
            movement.movementType,
            movement.recurrenceType
        ]);

        return result.rows[0] || null;
    }

    /**
     * Convierte un movimiento proyectado en movimiento real
     */
    private async convertToRealMovement(movement: any): Promise<void> {
        const client = await this.pool.connect();

        try {
            await client.query('BEGIN');

            // Obtener el plan del usuario
            const userQuery = `
                SELECT plan_id FROM "user" WHERE id = $1
            `;
            const userResult = await client.query(userQuery, [movement.userId]);
            const planId = userResult.rows[0]?.plan_id || 1; // Plan por defecto

            // Crear el movimiento real
            const movementData = {
                cardId: movement.cardId || 1,
                categoryId: movement.categoryId,
                amount: movement.amount,
                description: movement.description || 'Movimiento proyectado completado automáticamente',
                movementType: movement.movementType,
                movementSource: 'projected' as const,
                transactionDate: movement.expectedDate,
                metadata: {
                    projectedMovementId: movement.id,
                    originalExpectedDate: movement.expectedDate,
                    probability: movement.probability,
                    automated: true,
                    processedAt: new Date().toISOString()
                }
            };

            const newMovement = await this.movementService.createMovement(movementData, movement.userId, planId);

            // Actualizar el movimiento proyectado
            await this.projectedMovementService.updateProjectedMovement(
                movement.id,
                movement.userId,
                {
                    status: 'completed',
                    actualMovementId: newMovement.id
                }
            );

            // Si es recurrente, crear el siguiente movimiento proyectado
            if (movement.recurrenceType) {
                await this.createNextRecurringMovement(movement);
            }

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Crea el siguiente movimiento recurrente
     */
    private async createNextRecurringMovement(movement: any): Promise<void> {
        const nextDate = this.calculateNextRecurrenceDate(movement.expectedDate, movement.recurrenceType);
        
        if (nextDate) {
            // Obtener el plan del usuario
            const userQuery = `
                SELECT plan_id FROM "user" WHERE id = $1
            `;
            const userResult = await this.pool.query(userQuery, [movement.userId]);
            const planId = userResult.rows[0]?.plan_id || 1; // Plan por defecto

            await this.projectedMovementService.createProjectedMovement({
                userId: movement.userId,
                planId: planId,
                categoryId: movement.categoryId,
                cardId: movement.cardId,
                amount: movement.amount,
                description: movement.description,
                movementType: movement.movementType,
                expectedDate: nextDate,
                probability: movement.probability,
                recurrenceType: movement.recurrenceType
            });
        }
    }

    /**
     * Calcula la siguiente fecha de recurrencia
     */
    private calculateNextRecurrenceDate(currentDate: Date, recurrenceType: string): Date | null {
        const date = new Date(currentDate);
        
        switch (recurrenceType) {
            case 'weekly':
                date.setDate(date.getDate() + 7);
                break;
            case 'monthly':
                date.setMonth(date.getMonth() + 1);
                break;
            case 'yearly':
                date.setFullYear(date.getFullYear() + 1);
                break;
            default:
                return null;
        }
        
        return date;
    }

    /**
     * Ejecuta el procesamiento automático programado
     * Este método puede ser llamado por un cron job
     */
    async runScheduledProcessing(): Promise<void> {
        console.log('Iniciando procesamiento automático de movimientos proyectados...');
        
        try {
            const result = await this.processOverdueProjectedMovements();
            
            console.log(`Procesamiento completado:`, {
                procesados: result.processed,
                omitidos: result.skipped,
                errores: result.errors
            });

            if (result.processed > 0) {
                console.log('Movimientos procesados automáticamente:', result.details
                    .filter(d => d.status === 'processed')
                    .map(d => `ID: ${d.projectedId}, Usuario: ${d.userId}`)
                );
            }
        } catch (error) {
            console.error('Error en procesamiento programado:', error);
        }
    }

    /**
     * Obtiene estadísticas de procesamiento automático
     */
    async getAutomationStats(): Promise<{
        totalOverdue: number;
        highProbability: number;
        processedToday: number;
        lastProcessed: Date | null;
    }> {
        const stats = {
            totalOverdue: 0,
            highProbability: 0,
            processedToday: 0,
            lastProcessed: null as Date | null
        };

        try {
            // Total de movimientos vencidos
            const overdueQuery = `
                SELECT COUNT(*) as count
                FROM projected_movements
                WHERE status = 'pending' AND expected_date < CURRENT_DATE
            `;
            const overdueResult = await this.pool.query(overdueQuery);
            stats.totalOverdue = parseInt(overdueResult.rows[0].count);

            // Movimientos con alta probabilidad
            const highProbQuery = `
                SELECT COUNT(*) as count
                FROM projected_movements
                WHERE status = 'pending' 
                    AND expected_date < CURRENT_DATE 
                    AND probability >= 75
            `;
            const highProbResult = await this.pool.query(highProbQuery);
            stats.highProbability = parseInt(highProbResult.rows[0].count);

            // Movimientos procesados hoy
            const todayQuery = `
                SELECT COUNT(*) as count
                FROM movements
                WHERE movement_source = 'projected'
                    AND DATE(transaction_date) = CURRENT_DATE
                    AND metadata->>'automated' = 'true'
            `;
            const todayResult = await this.pool.query(todayQuery);
            stats.processedToday = parseInt(todayResult.rows[0].count);

            // Último procesamiento
            const lastQuery = `
                SELECT MAX(transaction_date) as last_date
                FROM movements
                WHERE movement_source = 'projected'
                    AND metadata->>'automated' = 'true'
            `;
            const lastResult = await this.pool.query(lastQuery);
            stats.lastProcessed = lastResult.rows[0].last_date;

        } catch (error) {
            console.error('Error obteniendo estadísticas de automatización:', error);
        }

        return stats;
    }
} 