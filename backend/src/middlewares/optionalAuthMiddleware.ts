import { Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest } from '../interfaces/AuthRequest';
import { IUserToken } from '../interfaces/IUser';

export const optionalAuthMiddleware: RequestHandler = (
  req,
  res,
  next
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      // No hay token, continuar sin autenticación
      next();
      return;
    }

    const token = authHeader.split(' ')[1]; // Bearer TOKEN
    if (!token) {
      // Token inválido, continuar sin autenticación
      next();
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
      
      (req as AuthRequest).user = decoded;
      next();
    } catch (error) {
      // Token inválido o expirado, continuar sin autenticación
      next();
    }
  } catch (error) {
    // Error general, continuar sin autenticación
    next();
  }
}; 