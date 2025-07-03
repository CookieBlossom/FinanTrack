import { Pool } from 'pg';
import { DatabaseError } from '../utils/errors';
import { ICard, ICardCreate, ICardUpdate } from '../interfaces/ICard';
import dotenv from 'dotenv';
import { pool } from '../config/database/connection';
import { PlanService } from './plan.service';
dotenv.config();

// @Injectable() // No es necesario para una clase que se instanciará manualmente en Express
export class CardService {
  private pool: Pool;
  planService: PlanService;

  constructor() { // Ya no recibe ConfigService
    this.pool = pool
    this.planService = new PlanService();
  }
  public async getTotalBalanceByUserId(userId: number): Promise<number> {
    const query = `
      SELECT COALESCE(SUM(balance), 0) as total
      FROM cards
      WHERE user_id = $1 AND status_account = 'active' AND LOWER(name_account) != 'efectivo'
    `;
    const result = await this.pool.query(query, [userId]);
    return Number(result.rows[0]?.total) || 0;
  }
  async countManualCards(userId: number): Promise<number> {
    const res = await this.pool.query(
      `SELECT COUNT(*) AS cnt
       FROM cards
       WHERE user_id = $1 AND source = 'manual' AND status_account = 'active'`,
      [userId]
    );
    return Number(res.rows[0].cnt);
  }

  async getCardById(cardId: number, userId: number): Promise<ICard | null> {
    try {
      const query = `
        SELECT 
          id,
          user_id as "userId",
          name_account as "nameAccount",
          alias_account as "aliasAccount",
          card_type_id as "cardTypeId",
          bank_id as "bankId",
          balance,
          currency,
          source,
          status_account as "statusAccount",
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM cards
        WHERE id = $1 AND user_id = $2
      `;

      const result = await this.pool.query(query, [cardId, userId]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error al obtener tarjeta:', error);
      throw new DatabaseError('Error al obtener la tarjeta');
    }
  }

  async updateBalance(cardId: number, userId: number, amount: number): Promise<void> {
    try {
      console.log(`[CardService] Actualizando balance:`);
      console.log(`  - Card ID: ${cardId} (tipo: ${typeof cardId})`);
      console.log(`  - User ID: ${userId} (tipo: ${typeof userId})`);
      console.log(`  - Amount: ${amount} (tipo: ${typeof amount})`);
      
      const query = `
        UPDATE cards
        SET 
          balance = balance + $1,
          updated_at = NOW()
        WHERE id = $2 AND user_id = $3
        RETURNING *
      `;

      console.log(`[CardService] Ejecutando query con parámetros: [${amount}, ${cardId}, ${userId}]`);
      const result = await this.pool.query(query, [amount, cardId, userId]);
      
      console.log(`[CardService] Resultado de la query:`, {
        rowCount: result.rowCount,
        rows: result.rows
      });
      
      if (result.rowCount === 0) {
        console.log(`[CardService] No se encontró tarjeta con ID ${cardId} para usuario ${userId}`);
        throw new DatabaseError('Tarjeta no encontrada');
      }
      
      console.log(`[CardService] Balance actualizado exitosamente`);
    } catch (error) {
      console.error('[CardService] Error al actualizar saldo:', error);
      console.error('[CardService] Error message:', (error as Error).message);
      console.error('[CardService] Error stack:', (error as Error).stack);
      console.error('[CardService] Error name:', (error as Error).name);
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError('Error al actualizar el saldo de la tarjeta');
    }
  }

  async getCardsByUserId(userId: number): Promise<ICard[]> {
    try {
      const query = `
        SELECT 
          id,
          user_id as "userId",
          name_account as "nameAccount",
          alias_account as "aliasAccount",
          card_type_id as "cardTypeId",
          bank_id as "bankId",
          balance,
          currency,
          source,
          status_account as "statusAccount",
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM cards
        WHERE user_id = $1
        ORDER BY created_at DESC
      `;

      const result = await this.pool.query(query, [userId]);
      return result.rows;
    } catch (error) {
      console.error('Error al obtener tarjetas del usuario:', error);
      throw new DatabaseError('Error al obtener las tarjetas');
    }
  }
  async createCard(
    cardData: Partial<ICard>,
    userId: number,
    planId: number
  ): Promise<ICard> {
    const limits = await this.planService.getLimitsForPlan(planId);
    if (limits.max_cards !== -1) {
      const used = await this.countManualCards(userId);
      if (used >= limits.max_cards) {
        throw new DatabaseError(
          `Has alcanzado el límite de ${limits.max_cards} tarjetas para tu plan`
        );
      }
    }

    const query = `
      INSERT INTO cards (
        user_id, name_account, alias_account, card_type_id,
        bank_id, balance, currency, source,
        status_account, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'active',$9,$9)
      RETURNING
        id, user_id AS "userId", name_account AS "nameAccount",
        alias_account AS "aliasAccount", card_type_id AS "cardTypeId",
        bank_id AS "bankId", balance, currency, source,
        status_account AS "statusAccount", created_at AS "createdAt",
        updated_at AS "updatedAt";
    `;
    const values = [
      userId,
      cardData.nameAccount!,
      cardData.aliasAccount || null,
      cardData.cardTypeId!,
      cardData.bankId || null,
      cardData.balance ?? 0,
      cardData.currency ?? 'CLP',
      cardData.source ?? 'manual',
      new Date()
    ];
    const res = await this.pool.query(query, values);
    return res.rows[0];
  }

  public async deleteCard(cardId: number, userId: number): Promise<void> {
    // 1. Elimina movimientos asociados (si NO tienes ON DELETE CASCADE)
    await this.pool.query('DELETE FROM movements WHERE card_id = $1', [cardId]);
    // 2. Elimina la tarjeta
    await this.pool.query('DELETE FROM cards WHERE id = $1 AND user_id = $2', [cardId, userId]);
  }
  async cardExists(userId: number, nameAccount: string, cardTypeId: number, bankId?: number): Promise<boolean> {
    const query = `
      SELECT 1 FROM cards
      WHERE user_id = $1
        AND name_account = $2
        AND card_type_id = $3
        AND bank_id IS NOT DISTINCT FROM $4
        AND status_account = 'active'
      LIMIT 1;
    `;
    const result = await this.pool.query(query, [userId, nameAccount, cardTypeId, bankId ?? null]);
    return result.rows.length > 0;
  }
  async updateCard(cardId: number, userId: number, cardData: Partial<ICard>): Promise<ICard> {
    try {
      const updateFields = [];
      const values = [];
      let paramCount = 1;

      const fieldsToUpdate = {
        nameAccount: 'name_account',
        aliasAccount: 'alias_account',
        cardTypeId: 'card_type_id',
        balance: 'balance',
        currency: 'currency',
        source: 'source',
        statusAccount: 'status_account'
      };
      for (const [key, dbField] of Object.entries(fieldsToUpdate)) {
        if (cardData[key as keyof ICard] !== undefined) {
          updateFields.push(`${dbField} = $${paramCount}`);
          values.push(cardData[key as keyof ICard]);
          paramCount++;
        }
      }

      updateFields.push('updated_at = NOW()');
      values.push(cardId, userId);

      const query = `
        UPDATE cards
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
        RETURNING 
          id,
          user_id as "userId",
          name_account as "nameAccount",
          alias_account as "aliasAccount",
          card_type_id as "cardTypeId",
          balance,
          currency,
          source,
          status_account as "statusAccount",
          created_at as "createdAt",
          updated_at as "updatedAt"
      `;

      const result = await this.pool.query(query, values);
      if (result.rowCount === 0) {
        throw new DatabaseError('Tarjeta no encontrada');
      }
      return result.rows[0];
    } catch (error) {
      console.error('Error al actualizar tarjeta:', error);
      throw new DatabaseError('Error al actualizar la tarjeta');
    }
  }

  async findOrCreateCard(
    userId: number,
    nameAccount: string,
    aliasAccount: string | null,
    initialBalance: number,
    createdAt: Date,
    source: 'manual' | 'scraper' | 'imported' | 'api',
    cardTypeId: number,
    bankId: number
  ): Promise<number> {
    try {
      const findQuery = `
        SELECT id
        FROM cards
        WHERE user_id = $1 AND name_account = $2 AND card_type_id = $3 AND bank_id = $4
      `;
      const findResult = await this.pool.query(findQuery, [userId, nameAccount, cardTypeId, bankId]);

      if (findResult.rows.length > 0) {
        return findResult.rows[0].id;
      }

      const createQuery = `
        INSERT INTO cards (
          user_id,
          name_account,
          alias_account,
          card_type_id,
          bank_id,
          balance,
          currency,
          source,
          status_account,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'CLP', $7, 'active', $8, $8)
        RETURNING id
      `;

      const values = [
        userId,
        nameAccount,
        aliasAccount,
        cardTypeId,
        bankId,
        initialBalance,
        source,
        createdAt
      ];

      const createResult = await this.pool.query(createQuery, values);
      return createResult.rows[0].id;
    } catch (error) {
      console.error('Error al buscar o crear tarjeta:', error);
      throw new DatabaseError('Error al buscar o crear la tarjeta');
    }
  }
} 