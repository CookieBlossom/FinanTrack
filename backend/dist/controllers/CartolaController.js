"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CartolaController = void 0;
const cartola_service_1 = require("../services/cartola.service");
const errors_1 = require("../utils/errors");
const pg_1 = require("pg");
class CartolaController {
    constructor() {
        this.uploadCartola = async (req, res, next) => {
            const crypto = await Promise.resolve().then(() => __importStar(require('crypto')));
            const client = await this.pool.connect();
            try {
                if (!req.file) {
                    return res.status(400).json({ error: 'No se ha proporcionado ningún archivo' });
                }
                if (req.file.mimetype !== 'application/pdf') {
                    return res.status(400).json({ error: 'El archivo debe ser un PDF' });
                }
                const user = req.user;
                if (!user) {
                    return res.status(401).json({ error: 'Usuario no autenticado' });
                }
                const fileBuffer = req.file.buffer;
                const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
                await client.connect();
                const existing = await client.query('SELECT * FROM statements WHERE user_id = $1 AND file_hash = $2', [user.id, hash]);
                if (existing.rows.length > 0) {
                    await client.release();
                    return res.status(409).json({ error: 'Esta cartola ya ha sido subida.' });
                }
                const cartola = await this.cartolaService.procesarCartolaPDF(fileBuffer);
                const cardId = await this.findOrCreateCard(user.id, cartola.tituloCartola, cartola.clienteNombre, cartola.saldoAnterior, cartola.fechaHoraConsulta);
                await this.cartolaService.guardarMovimientos(cardId, cartola.movimientos, user.id, user.planId, cartola.saldoFinal);
                await client.query(`INSERT INTO statements (user_id, card_id, file_hash, processed_at) 
         VALUES ($1, $2, $3, NOW())`, [user.id, cardId, hash]);
                await client.release();
                res.json({
                    message: 'Cartola procesada exitosamente',
                    resumen: {
                        tituloCartola: cartola.tituloCartola,
                        numeroCartola: cartola.numero,
                        fechaEmision: cartola.fechaEmision,
                        totalMovimientos: cartola.movimientos.length,
                        totalAbonos: cartola.totalAbonos,
                        totalCargos: cartola.totalCargos,
                        cardId: cardId
                    }
                });
            }
            catch (error) {
                client.release();
                console.error('Error al procesar cartola:', error);
                if (error instanceof errors_1.DatabaseError) {
                    if (error.message.includes('límite') || error.message.includes('no incluye')) {
                        return res.status(403).json({ error: error.message });
                    }
                    return res.status(500).json({ error: 'Error al guardar los movimientos en la base de datos' });
                }
                res.status(500).json({ error: 'Error al procesar la cartola' });
            }
        };
        this.cartolaService = new cartola_service_1.CartolaService();
        this.pool = new pg_1.Pool({
            user: process.env.DB_USER,
            host: process.env.DB_HOST,
            database: process.env.DB_NAME,
            password: process.env.DB_PASSWORD,
            port: parseInt(process.env.DB_PORT || '5432'),
        });
    }
    async findOrCreateCard(userId, tituloCartola, clienteNombre, saldoAnterior, fechaConsulta) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            // Extraer el número de cuenta del título
            const numeroMatch = tituloCartola.match(/N°\s*(\d+)/i);
            const numeroCuenta = numeroMatch ? numeroMatch[1] : '';
            // Determinar el tipo de cuenta y banco
            let nombreCuenta = `CuentaRUT - ${numeroCuenta}`;
            let cardTypeName = 'CUENTA RUT';
            const bankId = 1; // BancoEstado
            // Buscar una CuentaRUT existente de BancoEstado
            const findRutAccountQuery = `
        SELECT c.id 
        FROM cards c
        JOIN card_types ct ON c.card_type_id = ct.id
        WHERE c.user_id = $1 
        AND ct.name = $2
        AND c.bank_id = $3
        AND c.status_account = 'active'
        LIMIT 1
      `;
            const existingRutAccount = await client.query(findRutAccountQuery, [userId, cardTypeName, bankId]);
            if (existingRutAccount.rows.length > 0) {
                // Actualizar el saldo de la cuenta existente
                await client.query('UPDATE cards SET balance = balance + $1 WHERE id = $2', [saldoAnterior, existingRutAccount.rows[0].id]);
                await client.query('COMMIT');
                return existingRutAccount.rows[0].id;
            }
            // Si no existe la cuenta, buscar el tipo de tarjeta
            const findTypeQuery = `
        SELECT id FROM card_types 
        WHERE name = $1
        LIMIT 1
      `;
            const cardType = await client.query(findTypeQuery, [cardTypeName]);
            let cardTypeId;
            if (cardType.rows.length === 0) {
                const createTypeResult = await client.query('INSERT INTO card_types (name) VALUES ($1) RETURNING id', [cardTypeName]);
                cardTypeId = createTypeResult.rows[0].id;
            }
            else {
                cardTypeId = cardType.rows[0].id;
            }
            // Crear la nueva tarjeta
            const createCardResult = await client.query(`INSERT INTO cards (
          user_id, 
          name_account, 
          account_holder,
          card_type_id, 
          bank_id,
          balance, 
          balance_source,
          status_account,
          source
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
        RETURNING id`, [
                userId,
                nombreCuenta,
                clienteNombre,
                cardTypeId,
                bankId,
                0, // Iniciar con saldo 0, se actualizará con los movimientos
                'cartola',
                'active',
                'cartola'
            ]);
            await client.query('COMMIT');
            return createCardResult.rows[0].id;
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
}
exports.CartolaController = CartolaController;
//# sourceMappingURL=CartolaController.js.map