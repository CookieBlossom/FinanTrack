"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CardService = void 0;
const errors_1 = require("../utils/errors");
const dotenv_1 = __importDefault(require("dotenv"));
const connection_1 = require("../config/database/connection");
const plan_service_1 = require("./plan.service");
dotenv_1.default.config();
// @Injectable() // No es necesario para una clase que se instanciará manualmente en Express
class CardService {
    constructor() {
        this.pool = connection_1.pool;
        this.planService = new plan_service_1.PlanService();
    }
    getCardSelectFields() {
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
    getCardSelectFieldsWithPrefix(prefix = '') {
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
    async getTotalBalanceByUserId(userId) {
        const query = `
      SELECT COALESCE(SUM(balance), 0) as total
      FROM cards
      WHERE user_id = $1 AND status_account = 'active' AND LOWER(name_account) != 'efectivo'
    `;
        const result = await this.pool.query(query, [userId]);
        return Number(result.rows[0]?.total) || 0;
    }
    async countManualCards(userId) {
        const res = await this.pool.query(`SELECT COUNT(*) AS cnt
       FROM cards
       WHERE user_id = $1 AND source = 'manual' AND status_account = 'active'`, [userId]);
        return Number(res.rows[0].cnt);
    }
    async countAllManualCards(userId) {
        const res = await this.pool.query(`SELECT COUNT(*) AS cnt
       FROM cards
       WHERE user_id = $1 AND source = 'manual'`, [userId]);
        return Number(res.rows[0].cnt);
    }
    async getCardById(cardId, userId) {
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
        }
        catch (error) {
            console.error('Error al obtener tarjeta:', error);
            throw new errors_1.DatabaseError('Error al obtener la tarjeta');
        }
    }
    async updateBalance(cardId, userId, amount, source = 'manual') {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const result = await client.query(`UPDATE cards 
         SET balance = balance + $1,
             balance_source = $2,
             last_balance_update = NOW(),
             updated_at = NOW()
         WHERE id = $3 AND user_id = $4 
         RETURNING *`, [amount, source, cardId, userId]);
            if (result.rowCount === 0) {
                throw new Error(`No se encontró tarjeta con ID ${cardId} para usuario ${userId}`);
            }
            await client.query('COMMIT');
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    async getCardsByUserId(userId) {
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
        }
        catch (error) {
            console.error('Error al obtener tarjetas del usuario:', error);
            throw new errors_1.DatabaseError('Error al obtener las tarjetas');
        }
    }
    async createCard(cardData, userId, planId) {
        const limits = await this.planService.getLimitsForPlan(planId);
        if (limits.max_cards !== undefined && limits.max_cards !== -1) {
            const used = await this.countAllManualCards(userId);
            if (used >= limits.max_cards) {
                throw new errors_1.DatabaseError(`Has alcanzado el límite de ${limits.max_cards} tarjetas para tu plan`);
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
    async deleteCard(cardId, userId) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            // Verificar que la tarjeta pertenece al usuario
            const cardCheck = await client.query('SELECT id FROM cards WHERE id = $1 AND user_id = $2', [cardId, userId]);
            if (cardCheck.rowCount === 0) {
                throw new errors_1.DatabaseError('No se encontró la tarjeta para eliminar');
            }
            const movementsResult = await client.query(`DELETE FROM movements 
         WHERE card_id = $1 
         AND card_id IN (SELECT id FROM cards WHERE user_id = $2)`, [cardId, userId]);
            console.log(`[CardService] Eliminados ${movementsResult.rowCount} movimientos de la tarjeta ${cardId}`);
            // Eliminar la tarjeta
            const result = await client.query('DELETE FROM cards WHERE id = $1 AND user_id = $2 RETURNING name_account', [cardId, userId]);
            console.log(`[CardService] Tarjeta eliminada: ${result.rows[0]?.name_account}`);
            await client.query('COMMIT');
        }
        catch (error) {
            await client.query('ROLLBACK');
            console.error('[CardService] Error al eliminar tarjeta:', error);
            throw error;
        }
        finally {
            client.release();
        }
    }
    async cardExists(userId, nameAccount, cardTypeId, bankId) {
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
    async updateCard(cardId, userId, cardData) {
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
                if (cardData[key] !== undefined) {
                    updateFields.push(`${dbField} = $${paramCount}`);
                    values.push(cardData[key]);
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
                throw new errors_1.DatabaseError('Tarjeta no encontrada');
            }
            return result.rows[0];
        }
        catch (error) {
            console.error('Error al actualizar tarjeta:', error);
            throw new errors_1.DatabaseError('Error al actualizar la tarjeta');
        }
    }
    async findOrCreateCard(userId, nameAccount, accountHolder, initialBalance, createdAt, source, cardTypeId, bankId) {
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
        }
        catch (error) {
            console.error('Error al buscar o crear tarjeta:', error);
            throw new errors_1.DatabaseError('Error al buscar o crear la tarjeta');
        }
    }
    async findCardByRut(rut, userId) {
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
        }
        catch (error) {
            console.error('Error al buscar tarjeta por RUT:', error);
            throw new errors_1.DatabaseError('Error al buscar la tarjeta');
        }
    }
    async findOrUpdateCardFromCartola(userId, nameAccount, accountHolder, balance, cardTypeId, bankId) {
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
            }
            else {
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
        }
        catch (error) {
            console.error('Error en findOrUpdateCardFromCartola:', error);
            throw new errors_1.DatabaseError('Error al procesar la tarjeta desde la cartola');
        }
    }
    async updateBalanceFromCartola(cardId, userId, newBalance) {
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
                throw new errors_1.DatabaseError('No se encontró la tarjeta para actualizar');
            }
        }
        catch (error) {
            console.error('Error al actualizar saldo desde cartola:', error);
            throw new errors_1.DatabaseError('Error al actualizar el saldo de la tarjeta');
        }
    }
    async findOrCreateCuentaRUT(userId, accountHolder, balance, source = 'imported', rutForName) {
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
            }
            else {
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
        }
        catch (error) {
            console.error('[CardService] Error en findOrCreateCuentaRUT:', error);
            console.error('[CardService] Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
            throw new errors_1.DatabaseError('Error al procesar la Cuenta RUT');
        }
    }
    /**
     * Versión mejorada de findOrUpdateCardFromCartola con lógica específica para Cuenta RUT
     */
    async findOrUpdateCardFromCartolaV2(userId, nameAccount, accountHolder, balance, cardTypeId, bankId) {
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
        }
        catch (error) {
            console.error('[CardService] Error en findOrUpdateCardFromCartolaV2:', error);
            console.error('[CardService] Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
            throw new errors_1.DatabaseError('Error al procesar la tarjeta desde la cartola');
        }
    }
    /**
     * Versión mejorada de findOrCreateCard con lógica específica para Cuenta RUT para scraper
     */
    async findOrCreateCardFromScraper(userId, nameAccount, accountHolder, initialBalance, source = 'scraper', accountNumber) {
        try {
            console.log(`[CardService] findOrCreateCardFromScraper - Procesando cuenta:`, {
                nameAccount,
                accountHolder,
                initialBalance,
                source,
                accountNumber
            });
            // Detectar si es CuentaRUT
            const isCuentaRUT = nameAccount.toUpperCase().includes('CUENTARUT') ||
                nameAccount.toUpperCase().includes('CUENTA RUT');
            if (isCuentaRUT) {
                console.log('[CardService] Detectada CuentaRUT, buscando cuenta existente...');
                // Buscar cualquier CuentaRUT existente de BancoEstado
                const findQuery = `
          SELECT id, name_account, balance, metadata
          FROM cards 
          WHERE user_id = $1 
          AND card_type_id = $2 
          AND bank_id = $3
          AND status_account = 'active'
          LIMIT 1
        `;
                const CUENTA_RUT_TYPE_ID = 9; // ID de tipo CuentaRUT
                const BANCO_ESTADO_ID = 1; // ID de BancoEstado
                const existingCard = await this.pool.query(findQuery, [userId, CUENTA_RUT_TYPE_ID, BANCO_ESTADO_ID]);
                if (existingCard.rows.length > 0) {
                    console.log(`[CardService] CuentaRUT existente encontrada: ${existingCard.rows[0].name_account}`);
                    // Actualizar la CuentaRUT existente
                    const updateQuery = `
            UPDATE cards 
            SET balance = $1,
                balance_source = 'scraper',
                last_balance_update = NOW(),
                account_holder = COALESCE($2, account_holder),
                metadata = COALESCE($3, metadata),
                updated_at = NOW()
            WHERE id = $4
            RETURNING id
          `;
                    const metadata = accountNumber ? JSON.stringify({ account_number: accountNumber }) : null;
                    const result = await this.pool.query(updateQuery, [
                        initialBalance,
                        accountHolder,
                        metadata,
                        existingCard.rows[0].id
                    ]);
                    return { cardId: result.rows[0].id, wasCreated: false };
                }
                // Si no existe, crear nueva CuentaRUT
                console.log('[CardService] Creando nueva CuentaRUT...');
                const createQuery = `
          INSERT INTO cards (
            user_id, name_account, account_holder, card_type_id,
            bank_id, balance, balance_source, source,
            status_account, last_balance_update, metadata, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, 'scraper', $7, 'active', NOW(), $8, NOW(), NOW())
          RETURNING id
        `;
                const metadata = accountNumber ? JSON.stringify({ account_number: accountNumber }) : null;
                const result = await this.pool.query(createQuery, [
                    userId,
                    nameAccount,
                    accountHolder,
                    CUENTA_RUT_TYPE_ID,
                    BANCO_ESTADO_ID,
                    initialBalance,
                    source,
                    metadata
                ]);
                return { cardId: result.rows[0].id, wasCreated: true };
            }
            // Para otras cuentas, detectar el tipo de cuenta y banco
            const cardTypeId = this.detectCardTypeFromName(nameAccount);
            const bankId = 1; // Por defecto BancoEstado
            // Buscar cuenta existente con el mismo número de cuenta si está disponible
            let findQuery = `
        SELECT id 
        FROM cards 
        WHERE user_id = $1 
        AND status_account = 'active'
        AND metadata->>'account_number' = $2
      `;
            let findParams = [userId, accountNumber];
            if (!accountNumber) {
                findQuery = `
          SELECT id 
          FROM cards 
          WHERE user_id = $1 
          AND name_account = $2 
          AND status_account = 'active'
          LIMIT 1
        `;
                findParams = [userId, nameAccount];
            }
            const existingCard = await this.pool.query(findQuery, findParams);
            if (existingCard.rows.length > 0) {
                // Actualizar cuenta existente
                const updateQuery = `
          UPDATE cards 
          SET balance = $1,
              balance_source = 'scraper',
              last_balance_update = NOW(),
              account_holder = COALESCE($2, account_holder),
              metadata = COALESCE($3, metadata),
              updated_at = NOW()
          WHERE id = $4
          RETURNING id
        `;
                const metadata = accountNumber ? JSON.stringify({ account_number: accountNumber }) : null;
                const result = await this.pool.query(updateQuery, [
                    initialBalance,
                    accountHolder,
                    metadata,
                    existingCard.rows[0].id
                ]);
                return { cardId: result.rows[0].id, wasCreated: false };
            }
            // Crear nueva cuenta
            const createQuery = `
        INSERT INTO cards (
          user_id, name_account, account_holder, card_type_id,
          bank_id, balance, balance_source, source,
          status_account, last_balance_update, metadata, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'scraper', $7, 'active', NOW(), $8, NOW(), NOW())
        RETURNING id
      `;
            const metadata = accountNumber ? JSON.stringify({ account_number: accountNumber }) : null;
            const result = await this.pool.query(createQuery, [
                userId,
                nameAccount,
                accountHolder,
                cardTypeId,
                bankId,
                initialBalance,
                source,
                metadata
            ]);
            return { cardId: result.rows[0].id, wasCreated: true };
        }
        catch (error) {
            console.error('[CardService] Error en findOrCreateCardFromScraper:', error);
            throw new errors_1.DatabaseError('Error al buscar o crear la tarjeta desde el scraper');
        }
    }
    detectCardTypeFromName(nameAccount) {
        const upperName = nameAccount.toUpperCase();
        if (upperName.includes('AHORRO')) {
            return 2; // Cuenta de Ahorro
        }
        else if (upperName.includes('PLAZO')) {
            return 3; // Cuenta a Plazo
        }
        else if (upperName.includes('VISTA')) {
            return 4; // Cuenta Vista
        }
        else if (upperName.includes('CORRIENTE')) {
            return 5; // Cuenta Corriente
        }
        else if (upperName.includes('CUENTARUT') || upperName.includes('CUENTA RUT')) {
            return 9; // CuentaRUT
        }
        return 1; // Tipo por defecto
    }
}
exports.CardService = CardService;
//# sourceMappingURL=card.service.js.map