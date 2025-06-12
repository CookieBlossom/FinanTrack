"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CardService = void 0;
const pg_1 = require("pg");
const errors_1 = require("../utils/errors");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// @Injectable() // No es necesario para una clase que se instanciará manualmente en Express
class CardService {
    constructor() {
        this.pool = new pg_1.Pool({
            user: process.env.DB_USER,
            host: process.env.DB_HOST,
            database: process.env.DB_NAME,
            password: process.env.DB_PASSWORD,
            port: parseInt(process.env.DB_PORT || '5432'),
        });
    }
    async getTotalBalanceByUserId(userId) {
        const query = `
      SELECT COALESCE(SUM(balance), 0) as total
      FROM cards
      WHERE user_id = $1 AND status_account = 'active' AND LOWER(name_account) != 'efectivo'
    `;
        const result = await this.pool.query(query, [userId]);
        return Number(result.rows[0]?.total) || 0;
    }
    async getCardById(cardId, userId) {
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
        }
        catch (error) {
            console.error('Error al obtener tarjeta:', error);
            throw new errors_1.DatabaseError('Error al obtener la tarjeta');
        }
    }
    async updateBalance(cardId, userId, amount) {
        try {
            const query = `
        UPDATE cards
        SET 
          balance = balance + $1,
          updated_at = NOW()
        WHERE id = $2 AND user_id = $3
        RETURNING *
      `;
            const result = await this.pool.query(query, [amount, cardId, userId]);
            if (result.rowCount === 0) {
                throw new errors_1.DatabaseError('Tarjeta no encontrada');
            }
        }
        catch (error) {
            console.error('Error al actualizar saldo:', error);
            throw new errors_1.DatabaseError('Error al actualizar el saldo de la tarjeta');
        }
    }
    async getCardsByUserId(userId) {
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
        }
        catch (error) {
            console.error('Error al obtener tarjetas del usuario:', error);
            throw new errors_1.DatabaseError('Error al obtener las tarjetas');
        }
    }
    async createCard(cardData) {
        try {
            const query = `
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
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', $9, $9)
        RETURNING id,
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
      `;
            const values = [
                cardData.userId,
                cardData.nameAccount,
                cardData.aliasAccount || null,
                cardData.cardTypeId,
                cardData.bankId || null,
                cardData.balance ?? 0,
                cardData.currency ?? 'CLP',
                cardData.source ?? 'manual',
                new Date()
            ];
            const result = await this.pool.query(query, values);
            return result.rows[0];
        }
        catch (error) {
            console.error('Error al crear tarjeta:', error);
            throw new errors_1.DatabaseError('Error al crear la tarjeta');
        }
    }
    async deleteCard(cardId, userId) {
        // 1. Elimina movimientos asociados (si NO tienes ON DELETE CASCADE)
        await this.pool.query('DELETE FROM movements WHERE card_id = $1', [cardId]);
        // 2. Elimina la tarjeta
        await this.pool.query('DELETE FROM cards WHERE id = $1 AND user_id = $2', [cardId, userId]);
    }
    async cardExists(userId, nameAccount, cardTypeId, bankId) {
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
    async updateCard(cardId, userId, cardData) {
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
                if (cardData[key] !== undefined) {
                    updateFields.push(`${dbField} = $${paramCount}`);
                    values.push(cardData[key]);
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
                throw new errors_1.DatabaseError('Tarjeta no encontrada');
            }
            return result.rows[0];
        }
        catch (error) {
            console.error('Error al actualizar tarjeta:', error);
            throw new errors_1.DatabaseError('Error al actualizar la tarjeta');
        }
    }
    async findOrCreateCard(userId, nameAccount, aliasAccount, initialBalance, createdAt, source, cardTypeId, bankId) {
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
        }
        catch (error) {
            console.error('Error al buscar o crear tarjeta:', error);
            throw new errors_1.DatabaseError('Error al buscar o crear la tarjeta');
        }
    }
}
exports.CardService = CardService;
//# sourceMappingURL=card.service.js.map