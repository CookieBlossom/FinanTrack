import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { IUserToken } from '../interfaces/IUser';

export const authMiddleware = (
  req: any,
  res: Response,
  next: NextFunction
): void => {
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
      ) as IUserToken
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