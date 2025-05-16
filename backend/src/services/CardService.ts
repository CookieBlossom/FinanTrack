import { Pool } from 'pg';
import { ICard, ICardCreate, ICardUpdate } from '../interfaces/ICard';
import { DatabaseError } from '../utils/errors';
import { pool } from '../config/database/connection';

export class CardService {
  public async getAllCardsByUserId(userId: number): Promise<ICard[]> {
    try {
      const query = `
        SELECT 
          c.id,
          c.user_id as "userId",
          c.name_account as "nameAccount",
          c.card_type_id as "cardTypeId",
          ct.name as "cardTypeName",
          c.balance,
          c.alias_account as "aliasAccount",
          c.currency,
          c.status_account as "statusAccount",
          c.created_at as "createdAt",
          c.updated_at as "updatedAt"
        FROM cards c
        JOIN card_types ct ON c.card_type_id = ct.id
        WHERE c.user_id = $1
        ORDER BY c.name_account;
      `;

      const result = await pool.query(query, [userId]);
      return result.rows;
    } catch (error: unknown) {
      throw new DatabaseError('Error fetching user cards');
    }
  }

  public async getCardById(id: number, userId: number): Promise<ICard> {
    try {
      const query = `
        SELECT 
          c.id,
          c.user_id as "userId",
          c.name_account as "nameAccount",
          c.card_type_id as "cardTypeId",
          ct.name as "cardTypeName",
          c.balance,
          c.alias_account as "aliasAccount",
          c.currency,
          c.status_account as "statusAccount",
          c.created_at as "createdAt",
          c.updated_at as "updatedAt"
        FROM cards c
        JOIN card_types ct ON c.card_type_id = ct.id
        WHERE c.id = $1 AND c.user_id = $2;
      `;

      const result = await pool.query(query, [id, userId]);
      if (!result.rows[0]) {
        throw new DatabaseError('Card not found');
      }

      return result.rows[0];
    } catch (error: unknown) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError('Error fetching card');
    }
  }

  public async createCard(userId: number, cardData: ICardCreate): Promise<ICard> {
    try {
      // Verificar que el tipo de tarjeta existe
      const checkTypeQuery = 'SELECT id FROM card_types WHERE id = $1';
      const typeResult = await pool.query(checkTypeQuery, [cardData.cardTypeId]);
      if (!typeResult.rows[0]) {
        throw new DatabaseError('Invalid card type');
      }

      const query = `
        INSERT INTO cards (
          user_id,
          name_account,
          card_type_id,
          balance,
          alias_account,
          currency
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING 
          id,
          user_id as "userId",
          name_account as "nameAccount",
          card_type_id as "cardTypeId",
          balance,
          alias_account as "aliasAccount",
          currency,
          status_account as "statusAccount",
          created_at as "createdAt",
          updated_at as "updatedAt";
      `;

      const values: (string | number | null)[] = [
        userId,
        cardData.nameAccount,
        cardData.cardTypeId,
        cardData.balance,
        cardData.aliasAccount || null,
        cardData.currency || 'CLP'
      ];

      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error: unknown) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError('Error creating card');
    }
  }

  public async updateCard(id: number, userId: number, cardData: ICardUpdate): Promise<ICard> {
    try {
      // Verificar que la tarjeta existe y pertenece al usuario
      const checkCard = await this.getCardById(id, userId);
      if (!checkCard) {
        throw new DatabaseError('Card not found');
      }

      // Si se está actualizando el tipo, verificar que existe
      if (cardData.cardTypeId) {
        const checkTypeQuery = 'SELECT id FROM card_types WHERE id = $1';
        const typeResult = await pool.query(checkTypeQuery, [cardData.cardTypeId]);
        if (!typeResult.rows[0]) {
          throw new DatabaseError('Invalid card type');
        }
      }

      const updates: string[] = [];
      const values: (string | number | null)[] = [id, userId];
      let paramCount = 3;

      if (cardData.nameAccount !== undefined) {
        updates.push(`name_account = $${paramCount}`);
        values.push(cardData.nameAccount);
        paramCount++;
      }

      if (cardData.cardTypeId !== undefined) {
        updates.push(`card_type_id = $${paramCount}`);
        values.push(cardData.cardTypeId);
        paramCount++;
      }

      if (cardData.balance !== undefined) {
        updates.push(`balance = $${paramCount}`);
        values.push(cardData.balance);
        paramCount++;
      }

      if (cardData.aliasAccount !== undefined) {
        updates.push(`alias_account = $${paramCount}`);
        values.push(cardData.aliasAccount);
        paramCount++;
      }

      if (cardData.currency !== undefined) {
        updates.push(`currency = $${paramCount}`);
        values.push(cardData.currency);
        paramCount++;
      }

      if (cardData.statusAccount !== undefined) {
        updates.push(`status_account = $${paramCount}`);
        values.push(cardData.statusAccount);
        paramCount++;
      }

      if (updates.length === 0) {
        throw new DatabaseError('No valid fields to update');
      }

      const query = `
        UPDATE cards
        SET ${updates.join(', ')}, updated_at = NOW()
        WHERE id = $1 AND user_id = $2
        RETURNING 
          id,
          user_id as "userId",
          name_account as "nameAccount",
          card_type_id as "cardTypeId",
          balance,
          alias_account as "aliasAccount",
          currency,
          status_account as "statusAccount",
          created_at as "createdAt",
          updated_at as "updatedAt";
      `;

      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error: unknown) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError('Error updating card');
    }
  }

  public async deleteCard(id: number, userId: number): Promise<void> {
    try {
      // Verificar si hay movimientos asociados
      const checkMovementsQuery = `
        SELECT COUNT(*) as count
        FROM movements
        WHERE card_id = $1;
      `;
      
      const movementsResult = await pool.query(checkMovementsQuery, [id]);
      if (movementsResult.rows[0].count > 0) {
        throw new DatabaseError('Cannot delete card with associated movements');
      }

      const query = `
        DELETE FROM cards
        WHERE id = $1 AND user_id = $2
        RETURNING id;
      `;

      const result = await pool.query(query, [id, userId]);
      if (!result.rows[0]) {
        throw new DatabaseError('Card not found');
      }
    } catch (error: unknown) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError('Error deleting card');
    }
  }

  public async updateBalance(id: number, userId: number, amount: number): Promise<ICard> {
    try {
      const query = `
        UPDATE cards
        SET balance = balance + $3, updated_at = NOW()
        WHERE id = $1 AND user_id = $2
        RETURNING 
          id,
          user_id as "userId",
          name_account as "nameAccount",
          card_type_id as "cardTypeId",
          balance,
          alias_account as "aliasAccount",
          currency,
          status_account as "statusAccount",
          created_at as "createdAt",
          updated_at as "updatedAt";
      `;

      const result = await pool.query(query, [id, userId, amount]);
      if (!result.rows[0]) {
        throw new DatabaseError('Card not found');
      }

      return result.rows[0];
    } catch (error: unknown) {
      throw new DatabaseError('Error updating card balance');
    }
  }
} 