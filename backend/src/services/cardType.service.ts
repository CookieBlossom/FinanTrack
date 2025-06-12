import { Pool } from 'pg';
import { ICardType, ICardTypeCreate, ICardTypeUpdate } from '../interfaces/ICardType';
import { DatabaseError } from '../utils/errors';
import { pool } from '../config/database/connection';

export class CardTypeService {
  public async getAllCardTypes(): Promise<ICardType[]> {
    const query = `SELECT id, name, created_at as "createdAt", updated_at as "updatedAt" FROM card_types ORDER BY name;`;
    const result = await pool.query(query);
    return result.rows;
  }
  public async detectCardTypeFromTitle(title: string): Promise<number> {
    try {
      const allCardTypesQuery = `SELECT id, name FROM card_types;`;
      const result = await pool.query(allCardTypesQuery);
      const types: { id: number; name: string }[] = result.rows;
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
    } catch (error) {
      throw new DatabaseError('Error detecting card type from title');
    }
  }
  public async removeAccents(str: string): Promise<string> {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  public async getCardTypeById(id: number): Promise<ICardType> {
    try {
      const query = `
        SELECT id, name, created_at as "createdAt", updated_at as "updatedAt"
        FROM card_types
        WHERE id = $1;
      `;

      const result = await pool.query(query, [id]);
      if (!result.rows[0]) {
        throw new DatabaseError('Card type not found');
      }

      return result.rows[0];
    } catch (error: unknown) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError('Error fetching card type');
    }
  }

  public async createCardType(cardType: ICardTypeCreate): Promise<ICardType> {
    try {
      const query = `
        INSERT INTO card_types (name)
        VALUES ($1)
        RETURNING id, name, created_at as "createdAt", updated_at as "updatedAt";
      `;

      const result = await pool.query(query, [cardType.name]);
      return result.rows[0];
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && error.code === '23505') {
        throw new DatabaseError('Card type name already exists');
      }
      throw new DatabaseError('Error creating card type');
    }
  }

  public async updateCardType(id: number, cardType: ICardTypeUpdate): Promise<ICardType> {
    try {
      const query = `
        UPDATE card_types
        SET name = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING id, name, created_at as "createdAt", updated_at as "updatedAt";
      `;

      const result = await pool.query(query, [cardType.name, id]);
      if (!result.rows[0]) {
        throw new DatabaseError('Card type not found');
      }

      return result.rows[0];
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && error.code === '23505') {
        throw new DatabaseError('Card type name already exists');
      }
      throw new DatabaseError('Error updating card type');
    }
  }

  public async deleteCardType(id: number): Promise<void> {
    try {
      // Primero verificamos si hay tarjetas usando este tipo
      const checkQuery = `
        SELECT COUNT(*) as count
        FROM cards
        WHERE card_type_id = $1;
      `;
      
      const checkResult = await pool.query(checkQuery, [id]);
      if (checkResult.rows[0].count > 0) {
        throw new DatabaseError('Cannot delete card type that is being used by cards');
      }

      const query = `
        DELETE FROM card_types
        WHERE id = $1
        RETURNING id;
      `;

      const result = await pool.query(query, [id]);
      if (!result.rows[0]) {
        throw new DatabaseError('Card type not found');
      }
    } catch (error: unknown) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError('Error deleting card type');
    }
  }
} 