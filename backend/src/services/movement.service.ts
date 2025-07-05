import { Pool } from 'pg';
import { DatabaseError } from '../utils/errors';
import { CardService } from './card.service';
import { IMovement, IMovementCreate, IMovementFilters, IMovementUpdate } from '../interfaces/IMovement';
import { CartolaService } from './cartola.service';
import { CompanyService } from './company.service';
import dotenv from 'dotenv';
import { pool } from '../config/database/connection';
import { PlanService } from './plan.service';
dotenv.config();

export class MovementService {
  private pool: Pool;
  private cardService: CardService;
  private cartolaService: CartolaService;
  private planService: PlanService;
  private companyService: CompanyService;

  constructor() {
    this.pool = pool;
    this.cardService = new CardService();
    this.cartolaService = new CartolaService();
    this.planService = new PlanService();
    this.companyService = new CompanyService();
  }

  private buildWhereClause(filters: IMovementFilters): { conditions: string[]; values: any[]; paramCount: number } {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (filters.cardId) {
      conditions.push(`m.card_id = $${paramCount}`);
      values.push(filters.cardId);
      paramCount++;
    }
    if (filters.categoryId) {
      conditions.push(`m.category_id = $${paramCount}`);
      values.push(filters.categoryId);
      paramCount++;
    }
    if (filters.startDate) {
      conditions.push(`m.transaction_date >= $${paramCount}`);
      values.push(filters.startDate);
      paramCount++;
    }
    if (filters.endDate) {
      conditions.push(`m.transaction_date <= $${paramCount}`);
      values.push(filters.endDate);
      paramCount++;
    }
    if (filters.movementType) {
      conditions.push(`m.movement_type = $${paramCount}`);
      values.push(filters.movementType);
      paramCount++;
    }
    if (filters.movementSource) {
      conditions.push(`m.movement_source = $${paramCount}`);
      values.push(filters.movementSource);
      paramCount++;
    }
    if (filters.minAmount !== undefined) {
      conditions.push(`m.amount >= $${paramCount}`);
      values.push(filters.minAmount);
      paramCount++;
    }
    if (filters.maxAmount !== undefined) {
      conditions.push(`m.amount <= $${paramCount}`);
      values.push(filters.maxAmount);
      paramCount++;
    }

    return { conditions, values, paramCount };
  }
  async countMonthlyManualMoves(userId: number): Promise<number> {
    const monthStart = new Date();
    monthStart.setDate(1); monthStart.setHours(0,0,0,0);
    const res = await this.pool.query(
      `SELECT COUNT(*) AS cnt
       FROM movements m
       JOIN cards c ON m.card_id = c.id
       WHERE c.user_id = $1
         AND m.movement_source = 'manual'
         AND m.transaction_date >= $2`,
      [userId, monthStart]
    );
    return Number(res.rows[0].cnt);
  }

  async countMonthlyCartolaMoves(userId: number): Promise<number> {
    const monthStart = new Date();
    monthStart.setDate(1); monthStart.setHours(0,0,0,0);
    const res = await this.pool.query(
      `SELECT COUNT(*) AS cnt
       FROM movements m
       JOIN cards c ON m.card_id = c.id
       WHERE c.user_id = $1
         AND m.movement_source = 'cartola'
         AND m.transaction_date >= $2`,
      [userId, monthStart]
    );
    return Number(res.rows[0].cnt);
  }

  async countMonthlyScraperMoves(userId: number): Promise<number> {
    const monthStart = new Date();
    monthStart.setDate(1); monthStart.setHours(0,0,0,0);
    const res = await this.pool.query(
      `SELECT COUNT(*) AS cnt
       FROM movements m
       JOIN cards c ON m.card_id = c.id
       WHERE c.user_id = $1
         AND m.movement_source = 'scraper'
         AND m.transaction_date >= $2`,
      [userId, monthStart]
    );
    return Number(res.rows[0].cnt);
  }

  async getMovements(filters: IMovementFilters = {}): Promise<IMovement[]> {
    try {
      const { conditions, values } = this.buildWhereClause(filters);
      let query = `
        SELECT 
          m.id, m.card_id as "cardId", m.category_id as "categoryId",
          cat.name_category as "categoryName",
          cat.color as "categoryColor",
          m.amount, m.description, m.movement_type as "movementType",
          m.movement_source as "movementSource", 
          m.transaction_date as "transactionDate",
          m.metadata,
          m.created_at as "createdAt", m.updated_at as "updatedAt"
        FROM movements m
        LEFT JOIN categories cat ON m.category_id = cat.id
      `;

      if (filters.userId) {
        query += ` JOIN cards c ON m.card_id = c.id AND c.user_id = $${values.length + 1}`;
        values.push(filters.userId);
      }

      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }

      query += ` ORDER BY m.transaction_date DESC, m.created_at DESC`;

      const result = await this.pool.query(query, values);
      return result.rows.map(row => ({
        ...row,
        transactionDate: new Date(row.transactionDate),
        category: row.categoryId ? {
          id: row.categoryId,
          nameCategory: row.categoryName,
          color: row.categoryColor
        } : undefined
      }));
    } catch (error) {
      console.error('[MovementService] Error al obtener movimientos:', error);
      throw new DatabaseError('Error al obtener los movimientos');
    }
  }

  async getMovementById(id: number): Promise<IMovement | null> {
    try {
      const query = `
        SELECT 
          m.id, m.card_id as "cardId", m.category_id as "categoryId",
          cat.name_category as "categoryName",
          cat.color as "categoryColor",
          m.amount, m.description, m.movement_type as "movementType",
          m.movement_source as "movementSource",
          m.transaction_date as "transactionDate", 
          m.metadata,
          m.created_at as "createdAt", m.updated_at as "updatedAt"
        FROM movements m
        LEFT JOIN categories cat ON m.category_id = cat.id
        WHERE m.id = $1
      `;
      const result = await this.pool.query(query, [id]);
      if (result.rows.length === 0) return null;
      const row = result.rows[0];
      return { 
        ...row, 
        transactionDate: new Date(row.transactionDate),
        category: row.categoryId ? {
          id: row.categoryId,
          nameCategory: row.categoryName,
          color: row.categoryColor
        } : undefined
      };
    } catch (error) {
      console.error('[MovementService] Error al obtener movimiento por ID:', error);
      throw new DatabaseError('Error al obtener el movimiento');
    }
  }
  public async getCashMovementsByUser(userId: number): Promise<IMovement[]> {
    try {
      const efectivoCardQuery = `
        SELECT id FROM cards 
        WHERE user_id = $1 AND card_type_id = (
          SELECT id FROM card_types WHERE name = 'Efectivo' LIMIT 1
        )
        AND status_account = 'active'
        LIMIT 1;
      `;
      const efectivoCardResult = await this.pool.query(efectivoCardQuery, [userId]);
      const efectivoCardId = efectivoCardResult.rows[0]?.id;
    
      if (!efectivoCardId) return [];
    
      const movementsQuery = `
        SELECT 
          m.id, m.card_id as "cardId", m.category_id as "categoryId",
          cat.name_category as "categoryName",
          cat.color as "categoryColor",
          m.amount, m.description, m.movement_type as "movementType",
          m.movement_source as "movementSource", 
          m.transaction_date as "transactionDate", 
          m.metadata,
          m.created_at as "createdAt", m.updated_at as "updatedAt",
          c.name_account as "cardName"
        FROM movements m
        JOIN cards c ON m.card_id = c.id
        LEFT JOIN categories cat ON m.category_id = cat.id
        WHERE m.card_id = $1
        ORDER BY m.transaction_date DESC, m.created_at DESC
      `;
      const result = await this.pool.query(movementsQuery, [efectivoCardId]);
      return result.rows.map(row => ({ 
        ...row, 
        transactionDate: new Date(row.transactionDate),
        card: { nameAccount: row.cardName },
        category: row.categoryId ? {
          id: row.categoryId,
          nameCategory: row.categoryName,
          color: row.categoryColor
        } : undefined
      }));
    } catch (error) {
      console.error('[MovementService] Error al obtener movimientos en efectivo:', error);
      throw new DatabaseError('Error al obtener los movimientos en efectivo');
    }
  }

  public async getCardMovementsByUser(userId: number): Promise<IMovement[]> {
    try {
      const query = `
        SELECT 
          m.id, m.card_id as "cardId", m.category_id as "categoryId",
          cat.name_category as "categoryName",
          cat.color as "categoryColor",
          m.amount, m.description, m.movement_type as "movementType",
          m.movement_source as "movementSource", 
          m.transaction_date as "transactionDate", 
          m.metadata,
          m.created_at as "createdAt", m.updated_at as "updatedAt",
          c.name_account as "cardName"
        FROM movements m
        JOIN cards c ON m.card_id = c.id
        LEFT JOIN categories cat ON m.category_id = cat.id
        WHERE c.user_id = $1 
        AND c.status_account = 'active'
        AND c.card_type_id != (
          SELECT id FROM card_types WHERE name = 'Efectivo' LIMIT 1
        )
        ORDER BY m.transaction_date DESC, m.created_at DESC
      `;
      const result = await this.pool.query(query, [userId]);
      return result.rows.map(row => ({ 
        ...row, 
        transactionDate: new Date(row.transactionDate),
        card: { nameAccount: row.cardName },
        category: row.categoryId ? {
          id: row.categoryId,
          nameCategory: row.categoryName,
          color: row.categoryColor
        } : undefined
      }));
    } catch (error) {
      console.error('[MovementService] Error al obtener movimientos de tarjetas:', error);
      throw new DatabaseError('Error al obtener los movimientos de tarjetas');
    }
  }

  async getMovementsByMonth(userId: number, month: number, year: number): Promise<IMovement[]> {
    try {
      const query = `
        SELECT 
          m.id, m.card_id as "cardId", m.category_id as "categoryId",
          cat.name_category as "categoryName",
          cat.color as "categoryColor",
          m.amount, m.description, m.movement_type as "movementType",
          m.movement_source as "movementSource", 
          m.transaction_date as "transactionDate", 
          m.metadata,
          m.created_at as "createdAt", m.updated_at as "updatedAt"
        FROM movements m
        JOIN cards c ON m.card_id = c.id
        LEFT JOIN categories cat ON m.category_id = cat.id
        WHERE c.user_id = $1
        AND EXTRACT(MONTH FROM m.transaction_date) = $2
        AND EXTRACT(YEAR FROM m.transaction_date) = $3
        ORDER BY m.transaction_date DESC, m.created_at DESC
      `;
      const result = await this.pool.query(query, [userId, month, year]);
      return result.rows.map(row => ({ 
        ...row, 
        transactionDate: new Date(row.transactionDate),
        category: row.categoryId ? {
          id: row.categoryId,
          nameCategory: row.categoryName,
          color: row.categoryColor
        } : undefined
      }));
    } catch (error) {
      console.error('[MovementService] Error al obtener movimientos por mes:', error);
      throw new DatabaseError('Error al obtener los movimientos del mes');
    }
  }

  async createMovement(movementData: IMovementCreate, userId: number, planId: number): Promise<IMovement> {
    try {
      console.log(`[MovementService] Creando movimiento con datos:`, movementData);
      console.log(`[MovementService] Monto recibido: ${movementData.amount} (tipo: ${typeof movementData.amount})`);
      
      const card = await this.cardService.getCardById(movementData.cardId, userId);
      if (!card) {
        throw new DatabaseError('Tarjeta no encontrada o no pertenece al usuario.');
      }

      // Verificar límites según el tipo de fuente
      const limits = await this.planService.getLimitsForPlan(planId);
      
      if (movementData.movementSource === 'manual') {
        // Verificar límite de movimientos manuales solo si no es ilimitado
        if (limits.manual_movements !== undefined && limits.manual_movements !== -1) {
          const used = await this.countMonthlyManualMoves(userId);
          if (used >= limits.manual_movements) {
            throw new DatabaseError(
              `Has excedido el límite de ${limits.manual_movements} movimientos manuales por mes`
            );
          }
        }
      } else if (movementData.movementSource === 'cartola') {
        // Verificar límite de movimientos de cartola solo si no es ilimitado
        if (limits.cartola_movements !== undefined && limits.cartola_movements !== -1) {
          const used = await this.countMonthlyCartolaMoves(userId);
          if (used >= limits.cartola_movements) {
            throw new DatabaseError(
              `Has excedido el límite de ${limits.cartola_movements} movimientos de cartola por mes`
            );
          }
        }
        // Verificar permiso para cartolas
        const hasPermission = await this.planService.hasPermission(planId, 'cartola_upload');
        if (!hasPermission) {
          throw new DatabaseError('Tu plan no permite subir cartolas bancarias');
        }
      } else if (movementData.movementSource === 'scraper') {
        // Verificar límite de movimientos del scraper solo si no es ilimitado
        if (limits.scraper_movements !== undefined && limits.scraper_movements !== -1) {
          const used = await this.countMonthlyScraperMoves(userId);
          if (used >= limits.scraper_movements) {
            throw new DatabaseError(
              `Has excedido el límite de ${limits.scraper_movements} movimientos del scraper por mes`
            );
          }
        }
        // Verificar permiso para scraper
        const hasPermission = await this.planService.hasPermission(planId, 'scraper_access');
        if (!hasPermission) {
          throw new DatabaseError('Tu plan no permite usar el scraper automático');
        }
      } else if (['imported','subscription'].includes(movementData.movementSource)) {
        // Verificar permiso para importación
        const hasPermission = await this.planService.hasPermission(planId, 'cartola_upload');
        if (!hasPermission) {
          throw new DatabaseError('Tu plan no permite importar movimientos');
        }
      }

      // Determinar el tipo de movimiento basado en la descripción si viene de cartola
      if (movementData.movementSource === 'cartola' && !movementData.movementType) {
        if (movementData.description.match(/COMPRA|GIRO|PAGO|TEF A|TRANSFERENCIA A/i)) {
          movementData.movementType = 'expense';
        } else if (movementData.description.match(/TEF DE|TRANSFERENCIA DE|DEPOSITO|ABONO/i)) {
          movementData.movementType = 'income';
        }
      }
  
      const amountForBalance = movementData.movementType === 'income' ? movementData.amount : -movementData.amount;
      console.log(`[MovementService] Calculando balance:`);
      console.log(`  - Tipo de movimiento: ${movementData.movementType}`);
      console.log(`  - Monto original: ${movementData.amount} (tipo: ${typeof movementData.amount})`);
      console.log(`  - Monto para balance: ${amountForBalance} (tipo: ${typeof amountForBalance})`);
      
      await this.cardService.updateBalance(movementData.cardId, userId, amountForBalance);

      // Si no se proporcionó una categoría, intentar categorizarla automáticamente
      if (!movementData.categoryId && movementData.description) {
        const categoryId = await this.companyService.findCategoryForDescription(movementData.description);
        if (categoryId) {
          movementData.categoryId = categoryId;
        }
      }

      const query = `
        INSERT INTO movements (
          card_id, category_id, amount, description, 
          movement_type, movement_source, transaction_date, metadata, 
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        RETURNING id, card_id as "cardId", category_id as "categoryId", 
                  amount, description, movement_type as "movementType", 
                  movement_source as "movementSource", transaction_date as "transactionDate", 
                  metadata, created_at as "createdAt", updated_at as "updatedAt"
      `;
      const values = [
        movementData.cardId,
        movementData.categoryId || null,
        movementData.amount,
        movementData.description,
        movementData.movementType,
        movementData.movementSource,
        movementData.transactionDate || new Date(),
        movementData.metadata || null 
      ];

      const result = await this.pool.query(query, values);
      const newMovement = result.rows[0];

      let categoryName: string | undefined = undefined;
      let categoryColor: string | undefined = undefined;
      if (newMovement.categoryId) {
        const category = await this.pool.query('SELECT name_category, color FROM categories WHERE id = $1', [newMovement.categoryId]);
        if (category.rows.length > 0) {
          categoryName = category.rows[0].name_category;
          categoryColor = category.rows[0].color;
        }
      }

      return { 
        ...newMovement, 
        transactionDate: new Date(newMovement.transactionDate),
        category: newMovement.categoryId ? {
          id: newMovement.categoryId,
          nameCategory: categoryName || '',
          color: categoryColor
        } : undefined
      };
    } catch (error) {
      console.error('[MovementService] Error al crear movimiento:', error);
      throw new DatabaseError('Error al crear el movimiento');
    }
  }

  async updateMovement(movementId: number, movementData: IMovementUpdate, userId: number): Promise<IMovement | null> {
    try {
      const currentMovement = await this.getMovementById(movementId);
      if (!currentMovement) {
        throw new DatabaseError('Movimiento no encontrado.');
      }
      const card = await this.cardService.getCardById(currentMovement.cardId, userId);
      if (!card) {
        throw new DatabaseError('El movimiento no pertenece a una tarjeta válida del usuario.');
      }

      // Primero revertimos el balance actual
      const amountToRevert = currentMovement.movementType === 'income' ? -Number(currentMovement.amount) : Number(currentMovement.amount);
      await this.cardService.updateBalance(currentMovement.cardId, userId, amountToRevert);

      const updateFields: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      const fieldsToUpdateMap: { [K in keyof IMovementUpdate]?: string } = {
        cardId: 'card_id',
        categoryId: 'category_id',
        amount: 'amount',
        description: 'description',
        movementType: 'movement_type',
        movementSource: 'movement_source',
        transactionDate: 'transaction_date',
        metadata: 'metadata'
      };

      for (const key in movementData) {
        if (movementData.hasOwnProperty(key)) {
          const typedKey = key as keyof IMovementUpdate;
          const dbField = fieldsToUpdateMap[typedKey];
          if (dbField && movementData[typedKey] !== undefined) {
            updateFields.push(`${dbField} = $${paramCount}`);
            values.push(movementData[typedKey]);
            paramCount++;
          }
        }
      }

      if (updateFields.length === 0) {
        return currentMovement;
      }

      updateFields.push('updated_at = NOW()');
      values.push(movementId);

      const query = `
        UPDATE movements
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING id, card_id as "cardId", category_id as "categoryId", 
                  amount, description, movement_type as "movementType", 
                  movement_source as "movementSource", transaction_date as "transactionDate", 
                  metadata, created_at as "createdAt", updated_at as "updatedAt"
      `;

      const result = await this.pool.query(query, values);
      if (result.rows.length === 0) return null;

      const updatedMovement = result.rows[0];

      // Aplicar el nuevo balance
      const newAmountForBalance = updatedMovement.movementType === 'income' ? Number(updatedMovement.amount) : -Number(updatedMovement.amount);
      await this.cardService.updateBalance(updatedMovement.cardId, userId, newAmountForBalance);

      let categoryName: string | undefined = undefined;
      let categoryColor: string | undefined = undefined;
      if (updatedMovement.categoryId) {
        const category = await this.pool.query('SELECT name_category, color FROM categories WHERE id = $1', [updatedMovement.categoryId]);
        if (category.rows.length > 0) {
          categoryName = category.rows[0].name_category;
          categoryColor = category.rows[0].color;
        }
      }
      return { ...updatedMovement, category: updatedMovement.categoryId ? {
        id: updatedMovement.categoryId,
        nameCategory: categoryName || '',
        color: categoryColor
      } : undefined, transactionDate: new Date(updatedMovement.transactionDate) };

    } catch (error) {
      console.error('[MovementService] Error al actualizar movimiento:', error);
      throw new DatabaseError('Error al actualizar el movimiento');
    }
  }

  async deleteMovement(movementId: number, userId: number): Promise<void> {
    try {
      console.log(`[MovementService] Iniciando eliminación de movimiento ${movementId} para usuario ${userId}`);
      
      const movement = await this.getMovementById(movementId);
      if (!movement) {
        console.log(`[MovementService] Movimiento ${movementId} no encontrado`);
        throw new DatabaseError('Movimiento no encontrado.');
      }
      console.log(`[MovementService] Movimiento encontrado:`, movement);
      
      const card = await this.cardService.getCardById(movement.cardId, userId);
      if (!card) {
        console.log(`[MovementService] Tarjeta ${movement.cardId} no encontrada para usuario ${userId}`);
        throw new DatabaseError('El movimiento no pertenece a una tarjeta válida del usuario.');
      }
      console.log(`[MovementService] Tarjeta encontrada:`, card);
      
      if (movement.movementSource === 'manual') {
        const userQuery = 'SELECT plan_id FROM "user" WHERE id = $1';
        const userResult = await this.pool.query(userQuery, [userId]);
        const planId = userResult.rows[0]?.plan_id;
        
        if (planId) {
          const limits = await this.planService.getLimitsForPlan(planId);
          if (limits.manual_movements !== -1) {
            const currentCount = await this.countMonthlyManualMoves(userId);
            // Al eliminar un movimiento manual, se reduce el conteo, no se verifica límite
            console.log(`[MovementService] Eliminando movimiento manual. Conteo actual: ${currentCount}`);
          }
        }
      }

      const amountToRevert = movement.movementType === 'income' ? -Number(movement.amount) : Number(movement.amount);
      console.log(`[MovementService] Calculando reversión de saldo:`);
      console.log(`  - Tipo de movimiento: ${movement.movementType}`);
      console.log(`  - Monto original: ${movement.amount} (tipo: ${typeof movement.amount})`);
      console.log(`  - Monto a revertir: ${amountToRevert} (tipo: ${typeof amountToRevert})`);
      console.log(`  - Tarjeta ID: ${movement.cardId}`);
      console.log(`  - Usuario ID: ${userId}`);
      
      try {
        await this.cardService.updateBalance(movement.cardId, userId, amountToRevert);
        console.log(`[MovementService] Saldo revertido exitosamente`);
      } catch (balanceError) {
        console.error(`[MovementService] Error específico al revertir saldo:`, balanceError);
        throw balanceError;
      }
      console.log(`[MovementService] Eliminando movimiento de la base de datos`);
      const query = 'DELETE FROM movements WHERE id = $1';
      const result = await this.pool.query(query, [movementId]);

      if (result.rowCount === 0) {
        console.log(`[MovementService] No se pudo eliminar el movimiento ${movementId}`);
        throw new DatabaseError('Error al eliminar el movimiento, no se encontró después de la verificación.');
      }
      
      console.log(`[MovementService] Movimiento ${movementId} eliminado exitosamente`);
    } catch (error) {
      console.error('[MovementService] Error al eliminar movimiento:', error);
      console.error('[MovementService] Error message:', (error as Error).message);
      console.error('[MovementService] Error stack:', (error as Error).stack);
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError('Error al eliminar el movimiento');
    }
  }

  async processCartolaMovements(buffer: Buffer, userId: number, planId: number): Promise<void> {
    try {
      const cartola = await this.cartolaService.procesarCartolaPDF(buffer);
      
      // Determinar el tipo de tarjeta basándose en el título
      const cardTypeId = this.cartolaService.detectCardTypeFromTitle(cartola.tituloCartola);
      const bankId = 1; // ID de BancoEstado
      const { card } = await this.cardService.findOrUpdateCardFromCartola(
        userId,
        cartola.tituloCartola,
        cartola.clienteNombre,
        cartola.saldoFinal,
        cardTypeId,
        bankId
      );

      // Guardar los movimientos
      await this.cartolaService.guardarMovimientos(
        card.id,
        cartola.movimientos,
        userId,
        planId,
        cartola.saldoFinal
      );
    } catch (error) {
      console.error('Error al procesar cartola:', error);
      throw error;
    }
  }

  async getMonthlySummary(userId: number, month: string): Promise<any> {
    // month: 'YYYY-MM'
    const [year, monthNum] = month.split('-').map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 1);

    // Solo tarjetas activas
    const cardIdsResult = await this.pool.query(
      `SELECT id FROM cards WHERE user_id = $1 AND status_account = 'active'`,
      [userId]
    );
    const cardIds = cardIdsResult.rows.map((row: any) => row.id);
    if (cardIds.length === 0) {
      return {
        month,
        totalIngresos: 0,
        totalEgresos: 0,
        movimientosTotales: 0,
        categoriaMayorGasto: null,
        diaMayorGasto: null,
        hasData: false
      };
    }

    // Totales
    const totalsResult = await this.pool.query(`
      SELECT
        SUM(CASE WHEN movement_type = 'income' THEN amount ELSE 0 END) AS total_ingresos,
        SUM(CASE WHEN movement_type = 'expense' THEN amount ELSE 0 END) AS total_egresos,
        COUNT(*) AS movimientos_totales
      FROM movements
      WHERE card_id = ANY($1)
        AND transaction_date >= $2
        AND transaction_date < $3
    `, [cardIds, startDate, endDate]);
    const totals = totalsResult.rows[0];

    // Categoría mayor gasto
    const catResult = await this.pool.query(`
      SELECT c.id, c.name_category, SUM(m.amount) AS monto
      FROM movements m
      JOIN categories c ON m.category_id = c.id
      WHERE m.card_id = ANY($1)
        AND m.movement_type = 'expense'
        AND m.transaction_date >= $2
        AND m.transaction_date < $3
      GROUP BY c.id, c.name_category
      ORDER BY monto DESC
      LIMIT 1
    `, [cardIds, startDate, endDate]);
    const categoriaMayorGasto = catResult.rows[0] || null;

    // Día mayor gasto
    const dayResult = await this.pool.query(`
      SELECT DATE(transaction_date) AS fecha, SUM(amount) AS monto
      FROM movements
      WHERE card_id = ANY($1)
        AND movement_type = 'expense'
        AND transaction_date >= $2
        AND transaction_date < $3
      GROUP BY fecha
      ORDER BY monto DESC
      LIMIT 1
    `, [cardIds, startDate, endDate]);
    const diaMayorGasto = dayResult.rows[0] || null;

    const hasData = Number(totals.movimientos_totales) > 0;

    return {
      month,
      totalIngresos: Number(totals.total_ingresos) || 0,
      totalEgresos: Number(totals.total_egresos) || 0,
      movimientosTotales: Number(totals.movimientos_totales) || 0,
      categoriaMayorGasto,
      diaMayorGasto,
      hasData
    };
  }

  async validateMovement(movement: IMovement, userId: number): Promise<void> {
    // Verificar que la tarjeta pertenece al usuario
    const card = await this.cardService.getCardById(movement.cardId, userId);
    if (!card) {
      throw new Error('Tarjeta no encontrada o no pertenece al usuario');
    }
  }
} 