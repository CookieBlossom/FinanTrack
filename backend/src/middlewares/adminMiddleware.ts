import { Response, NextFunction } from 'express';
import { AuthRequest } from '../interfaces/AuthRequest';

export const adminMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Usuario no autenticado' });
    return;
  }

  if (req.user.role !== 'admin') {
    res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de administrador' });
    return;
  }

  next();
}; 