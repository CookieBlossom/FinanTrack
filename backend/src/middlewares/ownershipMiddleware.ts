import { Response, NextFunction } from 'express';
import { AuthRequest } from '../interfaces/IAuth';
import { pool } from '../config/database/connection';
import { DatabaseError } from '../utils/errors';

interface OwnershipOptions {
  resourceType: 'card' | 'movement' | 'subscription' | 'goal';
  paramIdField?: string;
}

export const checkOwnership = (options: OwnershipOptions) => {
  return async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Usuario no autenticado' });
        return;
      }

      const resourceId = parseInt(req.params[options.paramIdField || 'id']);
      if (isNaN(resourceId)) {
        res.status(400).json({ error: 'ID de recurso inválido' });
        return;
      }

      let query: string;
      const values = [resourceId, req.user.id];

      switch (options.resourceType) {
        case 'card':
          query = 'SELECT id FROM cards WHERE id = $1 AND user_id = $2';
          break;
        case 'movement':
          query = `
            SELECT m.id 
            FROM movements m
            JOIN cards c ON m.card_id = c.id
            WHERE m.id = $1 AND c.user_id = $2
          `;
          break;
        case 'subscription':
          query = 'SELECT id FROM subscriptions WHERE id = $1 AND user_id = $2';
          break;
        case 'goal':
          query = 'SELECT id FROM goals WHERE id = $1 AND user_id = $2';
          break;
        default:
          res.status(500).json({ error: 'Tipo de recurso no soportado' });
          return;
      }

      const result = await pool.query(query, values);
      if (!result.rows[0]) {
        res.status(403).json({ 
          error: 'Acceso denegado: el recurso no pertenece al usuario' 
        });
        return;
      }

      next();
    } catch (error) {
      if (error instanceof DatabaseError) {
        res.status(400).json({ error: error.message });
      } else {
        next(error);
      }
    }
  };
}; 