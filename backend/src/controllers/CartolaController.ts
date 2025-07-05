import { Request, Response, NextFunction } from 'express';
import { MovementService } from '../services/movement.service';
import { DatabaseError } from '../utils/errors';
import { AuthRequest } from '../interfaces/AuthRequest';
import { Pool } from 'pg';
import { pool } from '../config/database/connection';

export class CartolaController {
  private movementService: MovementService;
  private pool: Pool;

  constructor() {
    this.movementService = new MovementService();
    this.pool = pool; // Usar la conexión compartida
  }

  public uploadCartola = async (req: Request & { file?: any }, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No se ha proporcionado ningún archivo' });
      }

      if (req.file.mimetype !== 'application/pdf') {
        return res.status(400).json({ error: 'El archivo debe ser un PDF' });
      }

      const user = (req as AuthRequest).user;
      if (!user) {
        return res.status(401).json({ error: 'Usuario no autenticado' });
      }
      console.log(`[CartolaController] Procesando cartola para usuario ${user.id} con plan ${user.planId}`);

      const fileBuffer = req.file.buffer;
      const crypto = await import('crypto');
      const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      const existing = await this.pool.query(
        'SELECT * FROM statements WHERE user_id = $1 AND file_hash = $2',
        [user.id, hash]
      );
      
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Esta cartola ya ha sido subida.' });
      }

      // Usar el sistema correcto del MovementService
      const result = await this.movementService.processCartolaMovements(fileBuffer, user.id, user.planId);

      // Registrar la cartola como procesada
      await this.pool.query(
        `INSERT INTO statements (user_id, card_id, file_hash, processed_at) 
         VALUES ($1, $2, $3, NOW())`,
        [user.id, result.cardId, hash]
      );

      console.log(`[CartolaController] Cartola procesada exitosamente para usuario ${user.id}, tarjeta ${result.cardId}, ${result.movementsCount} movimientos`);

      res.json({
        message: 'Cartola procesada exitosamente',
        success: true,
        data: {
          cardId: result.cardId,
          movementsCount: result.movementsCount
        }
      });

    } catch (error) {
      console.error('[CartolaController] Error al procesar cartola:', error);

      if (error instanceof DatabaseError) {
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
}