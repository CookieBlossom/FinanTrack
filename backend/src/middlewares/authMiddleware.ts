import { Response, NextFunction } from 'express';
import { AuthRequest } from '../interfaces/AuthRequest';
import jwt from 'jsonwebtoken';
import { IUserToken } from '../interfaces/IUser';
import { pool } from '../config/database/connection';

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({ error: 'No se proporcionó token de autenticación' });
      return;
    }

    const token = authHeader.split(' ')[1]; // Bearer TOKEN
    if (!token) {
      res.status(401).json({ error: 'Formato de token inválido' });
      return;
    }

    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || '2004'
      ) as IUserToken;

      // Verificar que el usuario existe y está activo
      const userQuery = 'SELECT id, is_active FROM "user" WHERE id = $1 AND deleted_at IS NULL';
      const userResult = await pool.query(userQuery, [decoded.id]);
      
      if (userResult.rows.length === 0) {
        res.status(401).json({ error: 'Usuario no encontrado' });
        return;
      }

      if (!userResult.rows[0].is_active) {
        res.status(401).json({ error: 'Usuario inactivo' });
        return;
      }

      // Asegurar que el token decodificado tenga un rol
      if (!decoded.role) {
        decoded.role = 'user'; // Rol por defecto
      }
      if (!decoded.name) {
        decoded.name = decoded.email;
      }
      
      // Asignar el usuario al request
      req.user = decoded;
      next();
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        res.status(401).json({ error: 'Token expirado' });
      } else if (error instanceof jwt.JsonWebTokenError) {
        res.status(401).json({ error: 'Token inválido' });
      } else {
        res.status(500).json({ error: 'Error al verificar el token' });
      }
    }
  } catch (error) {
    next(error);
  }
}; 