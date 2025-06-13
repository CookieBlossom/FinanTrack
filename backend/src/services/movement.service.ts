import { Pool } from 'pg';
import { DatabaseError } from '../utils/errors';
import { CardService } from './card.service';
import { IMovement, IMovementCreate, IMovementFilters, IMovementUpdate } from '../interfaces/IMovement';
import { CartolaService } from './cartola.service';
import dotenv from 'dotenv';
import { pool } from '../config/database/connection';
dotenv.config();

export class MovementService {
  private pool: Pool;
  private cardService: CardService;
  private cartolaService: CartolaService;

  constructor() {
    this.pool = pool;
    this.cardService = new CardService();
    this.cartolaService = new CartolaService();
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

  async getMovements(filters: IMovementFilters = {}): Promise<IMovement[]> {
    try {
      const { conditions, values } = this.buildWhereClause(filters);
      let query = `
        SELECT 
          m.id, m.card_id as "cardId", m.category_id as "categoryId",
          cat.name_category as "category",
          m.amount, m.description, m.movement_type as "movementType",
          m.movement_source as "movementSource", 
          m.transaction_date as "transactionDate",
          m.metadata,
          m.created_at as "createdAt", m.updated_at as "updatedAt"
        FROM movements m
        LEFT JOIN categories cat ON m.category_id = cat.id
      `;

      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }

      query += ` ORDER BY m.transaction_date DESC, m.created_at DESC`;

      const result = await this.pool.query(query, values);
      return result.rows.map(row => ({
        ...row,
        transactionDate: new Date(row.transactionDate)
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
          cat.name_category as "category",
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
      return { ...result.rows[0], transactionDate: new Date(result.rows[0].transactionDate) };
    } catch (error) {
      console.error('[MovementService] Error al obtener movimiento por ID:', error);
      throw new DatabaseError('Error al obtener el movimiento');
    }
  }
  public async getCashMovementsByUser(userId: number): Promise<IMovement[]> {
    const efectivoCardQuery = `
      SELECT id FROM cards 
      WHERE user_id = $1 AND card_type_id = (
        SELECT id FROM card_types WHERE name = 'Efectivo' LIMIT 1
      )
      LIMIT 1;
    `;
    const efectivoCardResult = await this.pool.query(efectivoCardQuery, [userId]);
    const efectivoCardId = efectivoCardResult.rows[0]?.id;
  
    if (!efectivoCardId) return [];
  
    const movementsQuery = `
      SELECT * FROM movements 
      WHERE card_id = $1 AND movement_source = 'manual'
      ORDER BY transaction_date DESC;
    `;
    const result = await this.pool.query(movementsQuery, [efectivoCardId]);
    return result.rows;
  }
  async getMovementsByMonth(userId: number, month: number, year: number): Promise<IMovement[]> {
    try {
      const query = `
        SELECT 
          m.id, m.card_id as "cardId", m.category_id as "categoryId",
          cat.name_category as "category",
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
      return result.rows.map(row => ({ ...row, transactionDate: new Date(row.transactionDate) }));
    } catch (error) {
      console.error('[MovementService] Error al obtener movimientos por mes:', error);
      throw new DatabaseError('Error al obtener los movimientos del mes');
    }
  }

  async createMovement(movementData: IMovementCreate, userId: number): Promise<IMovement> {
    try {
      const card = await this.cardService.getCardById(movementData.cardId, userId);
      if (!card) {
        throw new DatabaseError('Tarjeta no encontrada o no pertenece al usuario.');
      }

      const amountForBalance = movementData.movementType === 'income' ? movementData.amount : -movementData.amount;
      await this.cardService.updateBalance(movementData.cardId, userId, amountForBalance);

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
      if (newMovement.categoryId) {
        const category = await this.pool.query('SELECT name_category FROM categories WHERE id = $1', [newMovement.categoryId]);
        if (category.rows.length > 0) {
          categoryName = category.rows[0].name_category;
        }
      }

      return { ...newMovement, category: categoryName, transactionDate: new Date(newMovement.transactionDate) };
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
      let categoryName: string | undefined = undefined;
      if (updatedMovement.categoryId) {
        const category = await this.pool.query('SELECT name_category FROM categories WHERE id = $1', [updatedMovement.categoryId]);
        if (category.rows.length > 0) {
          categoryName = category.rows[0].name_category;
        }
      }
      return { ...updatedMovement, category: categoryName, transactionDate: new Date(updatedMovement.transactionDate) };

    } catch (error) {
      console.error('[MovementService] Error al actualizar movimiento:', error);
      throw new DatabaseError('Error al actualizar el movimiento');
    }
  }

  async deleteMovement(movementId: number, userId: number): Promise<void> {
    try {
      const movement = await this.getMovementById(movementId);
      if (!movement) {
        throw new DatabaseError('Movimiento no encontrado.');
      }
      const card = await this.cardService.getCardById(movement.cardId, userId);
      if (!card) {
        throw new DatabaseError('El movimiento no pertenece a una tarjeta válida del usuario.');
      }

      const amountToRevert = movement.movementType === 'income' ? -movement.amount : movement.amount;
      await this.cardService.updateBalance(movement.cardId, userId, amountToRevert);

      const query = 'DELETE FROM movements WHERE id = $1';
      const result = await this.pool.query(query, [movementId]);

      if (result.rowCount === 0) {
        throw new DatabaseError('Error al eliminar el movimiento, no se encontró después de la verificación.');
      }
    } catch (error) {
      console.error('[MovementService] Error al eliminar movimiento:', error);
      throw new DatabaseError('Error al eliminar el movimiento');
    }
  }

  async processCartolaMovements(buffer: Buffer, userId: number): Promise<void> {
    try {
      const cartola = await this.cartolaService.procesarCartolaPDF(buffer);

      // Obtener los tipos de tarjeta disponibles
      const cardTypesQuery = 'SELECT id, name FROM card_types';
      const cardTypesResult = await this.pool.query(cardTypesQuery);
      const cardTypesMap = cardTypesResult.rows.map((row: any) => ({
        id: row.id,
        name: row.name.toLowerCase().replace(/\s+/g, '').normalize("NFD").replace(/[\u0300-\u036f]/g, '')
      }));

      const cleanedTitle = cartola.tituloCartola
        .toLowerCase()
        .replace(/cartola|consulta|de|la|el|saldo|cuenta|corriente|vista|tarjeta/gi, '')
        .replace(/\s+/g, '')
        .normalize("NFD").replace(/[\u0300-\u036f]/g, '');

      let tipoCuenta = cardTypesMap.find(t => cleanedTitle.includes(t.name))?.id;
      if (!tipoCuenta) {
        tipoCuenta = cardTypesMap.find(t => t.name === 'otros')?.id || 9;
      }

      const cardId = await this.cardService.findOrCreateCard(
        userId,
        cartola.tituloCartola,
        cartola.clienteNombre,
        cartola.saldoFinal,
        cartola.fechaHoraConsulta,
        'imported',
        tipoCuenta,
        1
      );

      await this.cartolaService.guardarMovimientos(cardId, cartola.movimientos);
    } catch (error) {
      console.error('[MovementService] Error al procesar movimientos de cartola:', error);
      throw new DatabaseError('Error al procesar los movimientos de la cartola');
    }
  }
} 