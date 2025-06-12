import { Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest, TokenPayload } from '../interfaces/AuthRequest';
import { DatabaseError } from '../utils/errors';

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
        process.env.JWT_SECRET || 'your-secret-key'
      ) as TokenPayload;

      // Asegurar que el token decodificado tenga un rol
      if (!decoded.role) {
        decoded.role = 'user'; // Rol por defecto
      }

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