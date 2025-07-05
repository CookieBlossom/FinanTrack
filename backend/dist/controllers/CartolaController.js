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
const movement_service_1 = require("../services/movement.service");
const errors_1 = require("../utils/errors");
const connection_1 = require("../config/database/connection");
class CartolaController {
    constructor() {
        this.uploadCartola = async (req, res, next) => {
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
                console.log(`[CartolaController] Procesando cartola para usuario ${user.id} con plan ${user.planId}`);
                const fileBuffer = req.file.buffer;
                const crypto = await Promise.resolve().then(() => __importStar(require('crypto')));
                const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
                const existing = await this.pool.query('SELECT * FROM statements WHERE user_id = $1 AND file_hash = $2', [user.id, hash]);
                if (existing.rows.length > 0) {
                    return res.status(409).json({ error: 'Esta cartola ya ha sido subida.' });
                }
                // Usar el sistema correcto del MovementService
                const result = await this.movementService.processCartolaMovements(fileBuffer, user.id, user.planId);
                // Registrar la cartola como procesada
                await this.pool.query(`INSERT INTO statements (user_id, card_id, file_hash, processed_at) 
         VALUES ($1, $2, $3, NOW())`, [user.id, result.cardId, hash]);
                console.log(`[CartolaController] Cartola procesada exitosamente para usuario ${user.id}, tarjeta ${result.cardId}, ${result.movementsCount} movimientos`);
                res.json({
                    message: 'Cartola procesada exitosamente',
                    success: true,
                    data: {
                        cardId: result.cardId,
                        movementsCount: result.movementsCount
                    }
                });
            }
            catch (error) {
                console.error('[CartolaController] Error al procesar cartola:', error);
                if (error instanceof errors_1.DatabaseError) {
                    if (error.message.includes('límite') || error.message.includes('no incluye')) {
                        return res.status(403).json({ error: error.message });
                    }
                    return res.status(500).json({ error: 'Error al guardar los movimientos en la base de datos' });
                }
                res.status(500).json({
                    error: 'Error al procesar la cartola',
                    details: error instanceof Error ? error.message : 'Error desconocido'
                });
            }
        };
        this.movementService = new movement_service_1.MovementService();
        this.pool = connection_1.pool; // Usar la conexión compartida
    }
}
exports.CartolaController = CartolaController;
//# sourceMappingURL=CartolaController.js.map