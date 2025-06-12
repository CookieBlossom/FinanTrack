import { Response, NextFunction } from 'express';
import { AuthRequest } from '../interfaces/AuthRequest';

export const adminMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Usuario no autenticado' });
      return;
    }

    if (req.user.role !== 'admin') {
      res.status(403).json({ error: 'Acceso denegado: se requieren privilegios de administrador' });
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
}; 