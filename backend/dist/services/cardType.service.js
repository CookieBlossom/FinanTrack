"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CardTypeService = void 0;
const errors_1 = require("../utils/errors");
const connection_1 = require("../config/database/connection");
class CardTypeService {
    constructor() {
        this.pool = connection_1.pool;
    }
    async getAllCardTypes() {
        const query = `SELECT id, name, created_at as "createdAt", updated_at as "updatedAt" FROM card_types ORDER BY name;`;
        const result = await connection_1.pool.query(query);
        return result.rows;
    }
    async detectCardTypeFromTitle(title) {
        try {
            const allCardTypesQuery = `SELECT id, name FROM card_types;`;
            const result = await connection_1.pool.query(allCardTypesQuery);
            const types = result.rows;
            const cleanedTitle = (await this.removeAccents(title.toLowerCase()))
                .replace(/cartola|cuenta|banco|número|nro|de|la|del|sucursal/gi, '')
                .replace(/[^\w\s]/gi, '') // eliminar caracteres especiales
                .trim();
            for (const { id, name } of types) {
                const cleanedTypeName = await this.removeAccents(name.toLowerCase());
                if (cleanedTitle.includes(cleanedTypeName)) {
                    return id;
                }
            }
            const fallback = types.find(t => t.name.toLowerCase() === 'otros');
            return fallback?.id ?? 9;
        }
        catch (error) {
            throw new errors_1.DatabaseError('Error detecting card type from title');
        }
    }
    async removeAccents(str) {
        return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }
    async getCardTypeById(id) {
        try {
            const query = `
        SELECT id, name, created_at as "createdAt", updated_at as "updatedAt"
        FROM card_types
        WHERE id = $1;
      `;
            const result = await connection_1.pool.query(query, [id]);
            if (!result.rows[0]) {
                throw new errors_1.DatabaseError('Card type not found');
            }
            return result.rows[0];
        }
        catch (error) {
            if (error instanceof errors_1.DatabaseError) {
                throw error;
            }
            throw new errors_1.DatabaseError('Error fetching card type');
        }
    }
    async createCardType(cardType) {
        try {
            const query = `
        INSERT INTO card_types (name)
        VALUES ($1)
        RETURNING id, name, created_at as "createdAt", updated_at as "updatedAt";
      `;
            const result = await connection_1.pool.query(query, [cardType.name]);
            return result.rows[0];
        }
        catch (error) {
            if (error instanceof Error && 'code' in error && error.code === '23505') {
                throw new errors_1.DatabaseError('Card type name already exists');
            }
            throw new errors_1.DatabaseError('Error creating card type');
        }
    }
    async updateCardType(id, cardType) {
        try {
            const query = `
        UPDATE card_types
        SET name = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING id, name, created_at as "createdAt", updated_at as "updatedAt";
      `;
            const result = await connection_1.pool.query(query, [cardType.name, id]);
            if (!result.rows[0]) {
                throw new errors_1.DatabaseError('Card type not found');
            }
            return result.rows[0];
        }
        catch (error) {
            if (error instanceof Error && 'code' in error && error.code === '23505') {
                throw new errors_1.DatabaseError('Card type name already exists');
            }
            throw new errors_1.DatabaseError('Error updating card type');
        }
    }
    async deleteCardType(id) {
        try {
            // Primero verificamos si hay tarjetas usando este tipo
            const checkQuery = `
        SELECT COUNT(*) as count
        FROM cards
        WHERE card_type_id = $1;
      `;
            const checkResult = await connection_1.pool.query(checkQuery, [id]);
            if (checkResult.rows[0].count > 0) {
                throw new errors_1.DatabaseError('Cannot delete card type that is being used by cards');
            }
            const query = `
        DELETE FROM card_types
        WHERE id = $1
        RETURNING id;
      `;
            const result = await connection_1.pool.query(query, [id]);
            if (!result.rows[0]) {
                throw new errors_1.DatabaseError('Card type not found');
            }
        }
        catch (error) {
            if (error instanceof errors_1.DatabaseError) {
                throw error;
            }
            throw new errors_1.DatabaseError('Error deleting card type');
        }
    }
}
exports.CardTypeService = CardTypeService;
//# sourceMappingURL=cardType.service.js.map