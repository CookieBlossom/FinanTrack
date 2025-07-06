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

  private getCardSelectFields(): string {
    return `
      id,
      user_id as "userId",
      name_account as "nameAccount",
      account_holder as "accountHolder",
      card_type_id as "cardTypeId",
      bank_id as "bankId",
      balance,
      balance_source as "balanceSource",
      last_balance_update as "lastBalanceUpdate",
      source,
      status_account as "statusAccount",
      created_at as "createdAt",
      updated_at as "updatedAt"
    `;
  }

  private getCardSelectFieldsWithPrefix(prefix: string = ''): string {
    const p = prefix ? `${prefix}.` : '';
    return `
      ${p}id,
      ${p}user_id as "userId",
      ${p}name_account as "nameAccount",
      ${p}account_holder as "accountHolder",
      ${p}card_type_id as "cardTypeId",
      ${p}bank_id as "bankId",
      ${p}balance,
      ${p}balance_source as "balanceSource",
      ${p}last_balance_update as "lastBalanceUpdate",
      ${p}source,
      ${p}status_account as "statusAccount",
      ${p}created_at as "createdAt",
      ${p}updated_at as "updatedAt"
    `;
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

  async countAllManualCards(userId: number): Promise<number> {
    const res = await this.pool.query(
      `SELECT COUNT(*) AS cnt
       FROM cards
       WHERE user_id = $1 AND source = 'manual'`,
      [userId]
    );
    return Number(res.rows[0].cnt);
  }

  async getCardById(cardId: number, userId: number): Promise<ICard | null> {
    try {
      const query = `
        SELECT ${this.getCardSelectFields()}
        FROM cards
        WHERE id = $1 AND user_id = $2
      `;

      const result = await this.pool.query(query, [cardId, userId]);
      const card = result.rows[0] || null;
      
      console.log(`[CardService] getCardById: cardId=${cardId}, userId=${userId}, found=${!!card}`);
      if (!card) {
        console.log(`[CardService] No se encontró la tarjeta con ID ${cardId} para el usuario ${userId}`);
      }
      
      return card;
    } catch (error) {
      console.error('Error al obtener tarjeta:', error);
      throw new DatabaseError('Error al obtener la tarjeta');
    }
  }

  async updateBalance(cardId: number, userId: number, amount: number, source: 'manual' | 'cartola' = 'manual'): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `UPDATE cards 
         SET balance = balance + $1,
             balance_source = $2,
             last_balance_update = NOW(),
             updated_at = NOW()
         WHERE id = $3 AND user_id = $4 
         RETURNING *`,
        [amount, source, cardId, userId]
      );

      if (result.rowCount === 0) {
        throw new Error(`No se encontró tarjeta con ID ${cardId} para usuario ${userId}`);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getCardsByUserId(userId: number): Promise<ICard[]> {
    try {
      const query = `
        SELECT ${this.getCardSelectFields()}
        FROM cards
        WHERE user_id = $1
        ORDER BY created_at DESC
      `;

      const result = await this.pool.query(query, [userId]);
      const cards = result.rows;
      
      console.log(`[CardService] getCardsByUserId: userId=${userId}, found=${cards.length} cards`);
      cards.forEach(card => {
        console.log(`  - ID: ${card.id}, Name: ${card.nameAccount}, Status: ${card.statusAccount}`);
      });
      
      return cards;
    } catch (error) {
      console.error('Error al obtener tarjetas del usuario:', error);
      throw new DatabaseError('Error al obtener las tarjetas');
    }
  }

  async createCard(cardData: ICardCreate, userId: number, planId: number): Promise<ICard> {
    const limits = await this.planService.getLimitsForPlan(planId);
    if (limits.max_cards !== undefined && limits.max_cards !== -1) {
      const used = await this.countAllManualCards(userId);
      if (used >= limits.max_cards) {
        throw new DatabaseError(
          `Has alcanzado el límite de ${limits.max_cards} tarjetas para tu plan`
        );
      }
    }

    const query = `
      INSERT INTO cards (
        user_id, name_account, account_holder, card_type_id,
        bank_id, balance, balance_source, source,
        status_account, last_balance_update, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', NOW(), NOW(), NOW())
      RETURNING ${this.getCardSelectFields()}
    `;

    const values = [
      userId,
      cardData.nameAccount,
      cardData.accountHolder || null,
      cardData.cardTypeId,
      cardData.bankId || null,
      cardData.balance || 0,
      cardData.balanceSource || 'manual',
      cardData.source || 'manual'
    ];

    const res = await this.pool.query(query, values);
    return res.rows[0];
  }

  public async deleteCard(cardId: number, userId: number): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      // Verificar que la tarjeta pertenece al usuario
      const cardCheck = await client.query(
        'SELECT id FROM cards WHERE id = $1 AND user_id = $2',
        [cardId, userId]
      );

      if (cardCheck.rowCount === 0) {
        throw new DatabaseError('No se encontró la tarjeta para eliminar');
      }
      const movementsResult = await client.query(
        `DELETE FROM movements 
         WHERE card_id = $1 
         AND card_id IN (SELECT id FROM cards WHERE user_id = $2)`,
        [cardId, userId]
      );
      
      console.log(`[CardService] Eliminados ${movementsResult.rowCount} movimientos de la tarjeta ${cardId}`);
      
      // Eliminar la tarjeta
      const result = await client.query(
        'DELETE FROM cards WHERE id = $1 AND user_id = $2 RETURNING name_account',
        [cardId, userId]
      );

      console.log(`[CardService] Tarjeta eliminada: ${result.rows[0]?.name_account}`);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[CardService] Error al eliminar tarjeta:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async cardExists(userId: number, nameAccount: string, cardTypeId: number, bankId?: number): Promise<boolean> {
    const query = `
      SELECT 1 FROM cards
      WHERE user_id = $1
        AND name_account = $2
        AND card_type_id = $3
        AND bank_id IS NOT DISTINCT FROM $4
      LIMIT 1;
    `;
    const result = await this.pool.query(query, [userId, nameAccount, cardTypeId, bankId ?? null]);
    return result.rows.length > 0;
  }

  async updateCard(cardId: number, userId: number, cardData: ICardUpdate): Promise<ICard> {
    try {
      const updateFields = [];
      const values = [];
      let paramCount = 1;

      const fieldsToUpdate = {
        nameAccount: 'name_account',
        accountHolder: 'account_holder',
        cardTypeId: 'card_type_id',
        balance: 'balance',
        balanceSource: 'balance_source',
        source: 'source',
        statusAccount: 'status_account'
      };

      for (const [key, dbField] of Object.entries(fieldsToUpdate)) {
        if (cardData[key as keyof ICardUpdate] !== undefined) {
          updateFields.push(`${dbField} = $${paramCount}`);
          values.push(cardData[key as keyof ICardUpdate]);
          paramCount++;
        }
      }

      // Si se actualiza el balance, actualizar también la fecha de última actualización
      if (cardData.balance !== undefined) {
        updateFields.push('last_balance_update = NOW()');
      }

      updateFields.push('updated_at = NOW()');
      values.push(cardId, userId);

      const query = `
        UPDATE cards
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
        RETURNING ${this.getCardSelectFields()}
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
    accountHolder: string | null,
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
          user_id, name_account, account_holder, card_type_id,
          bank_id, balance, balance_source, source,
          status_account, last_balance_update, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', $9, $9, $9)
        RETURNING id
      `;

      const values = [
        userId,
        nameAccount,
        accountHolder,
        cardTypeId,
        bankId,
        initialBalance,
        source === 'manual' ? 'manual' : 'cartola',
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

  async findCardByRut(rut: string, userId: number): Promise<ICard | null> {
    try {
      const query = `
        SELECT ${this.getCardSelectFieldsWithPrefix('c')}
        FROM cards c 
        WHERE c.user_id = $1 
        AND c.name_account = $2
        AND c.status_account = 'active'
        LIMIT 1
      `;
      
      const result = await this.pool.query(query, [userId, rut]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error al buscar tarjeta por RUT:', error);
      throw new DatabaseError('Error al buscar la tarjeta');
    }
  }

  async findOrUpdateCardFromCartola(
    userId: number,
    nameAccount: string,
    accountHolder: string,
    balance: number,
    cardTypeId: number,
    bankId: number
  ): Promise<{ card: ICard; wasUpdated: boolean }> {
    try {
      const findQuery = `
        SELECT ${this.getCardSelectFields()}
        FROM cards 
        WHERE user_id = $1 
        AND name_account = $2 
        AND card_type_id = $3 
        AND bank_id = $4
        AND status_account = 'active'
      `;
      const existingCard = await this.pool.query(findQuery, [userId, nameAccount, cardTypeId, bankId]);

      if (existingCard.rows.length > 0) {
        const updateQuery = `
          UPDATE cards 
          SET balance = $1,
              balance_source = 'cartola',
              last_balance_update = NOW(),
              account_holder = $2,
              updated_at = NOW()
          WHERE id = $3
          RETURNING ${this.getCardSelectFields()}
        `;
        const result = await this.pool.query(updateQuery, [balance, accountHolder, existingCard.rows[0].id]);
        return { card: result.rows[0], wasUpdated: true };
      } else {
        const insertQuery = `
          INSERT INTO cards (
            user_id, name_account, account_holder, balance, 
            balance_source, card_type_id, bank_id, source,
            status_account, last_balance_update, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, 'cartola', $5, $6, 'imported', 'active', NOW(), NOW(), NOW())
          RETURNING ${this.getCardSelectFields()}
        `;
        const result = await this.pool.query(insertQuery, [
          userId, nameAccount, accountHolder, balance, cardTypeId, bankId
        ]);
        return { card: result.rows[0], wasUpdated: false };
      }
    } catch (error) {
      console.error('Error en findOrUpdateCardFromCartola:', error);
      throw new DatabaseError('Error al procesar la tarjeta desde la cartola');
    }
  }

  async updateBalanceFromCartola(cardId: number, userId: number, newBalance: number): Promise<void> {
    try {
      const updateQuery = `
        UPDATE cards 
        SET balance = $1,
            balance_source = 'cartola',
            last_balance_update = NOW(),
            updated_at = NOW()
        WHERE id = $2 AND user_id = $3
      `;
      const result = await this.pool.query(updateQuery, [newBalance, cardId, userId]);
      
      if (result.rowCount === 0) {
        throw new DatabaseError('No se encontró la tarjeta para actualizar');
      }
    } catch (error) {
      console.error('Error al actualizar saldo desde cartola:', error);
      throw new DatabaseError('Error al actualizar el saldo de la tarjeta');
    }
  }
  async findOrCreateCuentaRUT(
    userId: number,
    accountHolder: string,
    balance: number,
    source: 'manual' | 'scraper' | 'imported' | 'api' = 'imported',
    rutForName?: string
  ): Promise<{ card: ICard; wasCreated: boolean }> {
    try {
      console.log(`[CardService] findOrCreateCuentaRUT - Parámetros:`);
      console.log(`  userId: ${userId}`);
      console.log(`  accountHolder: "${accountHolder}"`);
      console.log(`  balance: ${balance}`);
      console.log(`  source: "${source}"`);
      console.log(`  rutForName: "${rutForName}"`);
      
      // Buscar si ya existe una tarjeta Cuenta RUT de BancoEstado
      const findQuery = `
        SELECT ${this.getCardSelectFields()}
        FROM cards 
        WHERE user_id = $1 
        AND card_type_id = $2 
        AND bank_id = $3
        AND status_account = 'active'
        LIMIT 1
      `;
      const CUENTA_RUT_TYPE_ID = 9; // Según schema
      const BANCO_ESTADO_ID = 1; // Según schema
      
      console.log(`[CardService] Buscando Cuenta RUT existente con query:`, {
        userId, 
        cardTypeId: CUENTA_RUT_TYPE_ID, 
        bankId: BANCO_ESTADO_ID
      });
      
      const existingCard = await this.pool.query(findQuery, [userId, CUENTA_RUT_TYPE_ID, BANCO_ESTADO_ID]);
      console.log(`[CardService] Resultado de búsqueda: ${existingCard.rows.length} tarjetas encontradas`);

      if (existingCard.rows.length > 0) {
        // Actualizar tarjeta existente
        console.log(`[CardService] Actualizando tarjeta existente ID: ${existingCard.rows[0].id}`);
        const updateQuery = `
          UPDATE cards 
          SET balance = $1,
              balance_source = $2,
              last_balance_update = NOW(),
              account_holder = $3,
              updated_at = NOW()
          WHERE id = $4
          RETURNING ${this.getCardSelectFields()}
        `;
        const balanceSource = source === 'manual' ? 'manual' : 'cartola';
        const result = await this.pool.query(updateQuery, [
          balance, 
          balanceSource, 
          accountHolder, 
          existingCard.rows[0].id
        ]);
        
        console.log(`[CardService] Cuenta RUT existente actualizada: ${existingCard.rows[0].nameAccount}`);
        if (result.rows.length === 0) {
          console.error('[CardService] ERROR: La actualización no retornó filas');
          throw new Error('Error al actualizar la tarjeta existente');
        }
        return { card: result.rows[0], wasCreated: false };
      } else {
        // Crear nueva tarjeta Cuenta RUT
        const nameAccount = rutForName || 'CuentaRUT';
        console.log(`[CardService] Creando nueva Cuenta RUT con nombre: "${nameAccount}"`);
        const insertQuery = `
          INSERT INTO cards (
            user_id, name_account, account_holder, balance, 
            balance_source, card_type_id, bank_id, source,
            status_account, last_balance_update, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', NOW(), NOW(), NOW())
          RETURNING ${this.getCardSelectFields()}
        `;
        const balanceSource = source === 'manual' ? 'manual' : 'cartola';
        const result = await this.pool.query(insertQuery, [
          userId, nameAccount, accountHolder, balance, balanceSource, 
          CUENTA_RUT_TYPE_ID, BANCO_ESTADO_ID, source
        ]);
        
        console.log(`[CardService] Nueva Cuenta RUT creada: ${nameAccount}`);
        if (result.rows.length === 0) {
          console.error('[CardService] ERROR: La inserción no retornó filas');
          throw new Error('Error al crear la nueva tarjeta');
        }
        return { card: result.rows[0], wasCreated: true };
      }
    } catch (error) {
      console.error('[CardService] Error en findOrCreateCuentaRUT:', error);
      console.error('[CardService] Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
      throw new DatabaseError('Error al procesar la Cuenta RUT');
    }
  }

  /**
   * Versión mejorada de findOrUpdateCardFromCartola con lógica específica para Cuenta RUT
   */
  async findOrUpdateCardFromCartolaV2(
    userId: number,
    nameAccount: string,
    accountHolder: string,
    balance: number,
    cardTypeId: number,
    bankId: number
  ): Promise<{ card: ICard; wasUpdated: boolean }> {
    try {
      console.log(`[CardService] findOrUpdateCardFromCartolaV2 - Parámetros recibidos:`);
      console.log(`  userId: ${userId}`);
      console.log(`  nameAccount: "${nameAccount}"`);
      console.log(`  accountHolder: "${accountHolder}"`);
      console.log(`  balance: ${balance}`);
      console.log(`  cardTypeId: ${cardTypeId}`);
      console.log(`  bankId: ${bankId}`);
      
      // Si es Cuenta RUT de BancoEstado, usar lógica especializada
      if (cardTypeId === 9 && bankId === 1) {
        console.log(`[CardService] Procesando Cuenta RUT con lógica especializada`);
        const result = await this.findOrCreateCuentaRUT(userId, accountHolder, balance, 'imported', nameAccount);
        console.log(`[CardService] Resultado de findOrCreateCuentaRUT:`, {
          cardId: result.card.id,
          cardName: result.card.nameAccount,
          wasCreated: result.wasCreated
        });
        return { card: result.card, wasUpdated: !result.wasCreated };
      }
      
      // Para otras tarjetas, usar lógica original
      console.log(`[CardService] Procesando tarjeta NO CuentaRUT con lógica original`);
      const result = await this.findOrUpdateCardFromCartola(userId, nameAccount, accountHolder, balance, cardTypeId, bankId);
      console.log(`[CardService] Resultado de findOrUpdateCardFromCartola:`, {
        cardId: result.card.id,
        cardName: result.card.nameAccount,
        wasUpdated: result.wasUpdated
      });
      return result;
    } catch (error) {
      console.error('[CardService] Error en findOrUpdateCardFromCartolaV2:', error);
      console.error('[CardService] Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
      throw new DatabaseError('Error al procesar la tarjeta desde la cartola');
    }
  }

  /**
   * Versión mejorada de findOrCreateCard con lógica específica para Cuenta RUT para scraper
   */
  async findOrCreateCardFromScraper(
    userId: number,
    nameAccount: string,
    accountHolder: string | null,
    initialBalance: number,
    source: 'scraper' | 'api' = 'scraper'
  ): Promise<{ cardId: number; wasCreated: boolean }> {
    try {
      // Detectar si es Cuenta RUT basándose en el nombre
      const isAccountRUT = nameAccount.toUpperCase().includes('CUENTARUT') || 
                          nameAccount.toUpperCase().includes('CUENTA RUT');
      
      if (isAccountRUT) {
        console.log(`[CardService] Procesando Cuenta RUT desde scraper con lógica especializada`);
        const result = await this.findOrCreateCuentaRUT(
          userId, 
          accountHolder || 'Usuario Scraper', 
          initialBalance, 
          source,
          nameAccount
        );
        return { cardId: result.card.id, wasCreated: result.wasCreated };
      }
      
      // Para otras tarjetas, usar lógica original
      // Detectar tipo de tarjeta y banco basándose en el nombre
      const cardTypeId = this.detectCardTypeFromName(nameAccount);
      const bankId = 1; // Por defecto BancoEstado para scraper
      
      const cardId = await this.findOrCreateCard(
        userId, 
        nameAccount, 
        accountHolder, 
        initialBalance, 
        new Date(), 
        source, 
        cardTypeId, 
        bankId
      );
      
      return { cardId, wasCreated: true }; // Asumimos que se creó porque findOrCreateCard no retorna esta info
    } catch (error) {
      console.error('Error en findOrCreateCardFromScraper:', error);
      throw new DatabaseError('Error al procesar la tarjeta desde el scraper');
    }
  }

  /**
   * Detecta el tipo de tarjeta basándose en el nombre
   */
  private detectCardTypeFromName(nameAccount: string): number {
    const name = nameAccount.toUpperCase();
    
    if (name.includes('CUENTARUT') || name.includes('CUENTA RUT')) {
      return 9; // CuentaRUT
    }
    if (name.includes('AHORRO')) {
      return 6; // Ahorro
    }
    if (name.includes('CREDITO')) {
      return 2; // Credito
    }
    if (name.includes('VISTA')) {
      return 2; // Cuenta Vista (usar ID de débito)
    }
    
    return 1; // Debito por defecto
  }
} 