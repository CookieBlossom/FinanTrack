import { Response } from 'express';
import { UserService } from '../services/user.service';
import { IUserLogin, IUserRegister } from '../interfaces/IUser';
import { AuthRequest } from '../interfaces/AuthRequest';
import { DatabaseError, UserAlreadyExistsError } from '../utils/errors';

export class UserController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  public register = async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      console.log('Recibida petición de registro con body:', req.body);
      const userData: IUserRegister = req.body;      
      const user = await this.userService.register(userData);      
      return res.status(201).json({
        success: true,
        message: 'Usuario registrado exitosamente',
        data: user
      });
    } catch (error: unknown) {
      console.error('Error en el controlador durante el registro:', error);
      
      // Manejar UserAlreadyExistsError específicamente
      if (error instanceof UserAlreadyExistsError) {
        return res.status(409).json({
          success: false,
          message: error.message,
          error: 'EMAIL_EXISTS'
        });
      }
      
      // Manejar DatabaseError
      if (error instanceof DatabaseError) {
        return res.status(400).json({
          success: false,
          message: error.message,
          error: 'VALIDATION_ERROR'
        });
      }
      
      // Error genérico
      console.error('Error no manejado:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: 'INTERNAL_ERROR'
      });
    }
  };

  public checkEmailExists = async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const { email } = req.body;
      
      if (!email || !email.trim()) {
        return res.status(400).json({
          success: false,
          message: 'El email es requerido',
          error: 'EMAIL_REQUIRED'
        });
      }

      const exists = await this.userService.checkEmailExists(email.trim());
      
      return res.status(200).json({
        success: true,
        exists: exists,
        message: exists ? 'El email ya está registrado' : 'El email está disponible'
      });
    } catch (error: unknown) {
      console.error('Error al verificar email:', error);
      
      if (error instanceof DatabaseError) {
        return res.status(400).json({
          success: false,
          message: error.message,
          error: 'VALIDATION_ERROR'
        });
      }
      
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: 'INTERNAL_ERROR'
      });
    }
  };

  public login = async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const credentials: IUserLogin = req.body;
      const result = await this.userService.login(credentials);
      console.log('Token generado para el usuario:', result.token);
      return res.status(200).json(result);
    } catch (error: unknown) {
      if (error instanceof DatabaseError) {
        const errorMessage = error.message;
        switch (errorMessage) {
          case 'El usuario no existe':
          case 'La contraseña es incorrecta':
            return res.status(401).json({ 
              success: false,
              message: 'El correo electrónico o la contraseña son incorrectos'
            });
          case 'La cuenta está desactivada':
            return res.status(403).json({ 
              success: false,
              message: 'Tu cuenta está desactivada. Por favor, contacta con soporte.'
            });
          case 'El correo electrónico y la contraseña son requeridos':
            return res.status(400).json({ 
              success: false,
              message: errorMessage
            });
          default:
            return res.status(500).json({ 
              success: false,
              message: 'Error interno del servidor'
            });
        }
      }
      return res.status(500).json({ 
        success: false,
        message: 'Error interno del servidor'
      });
    }
  };

  public getProfile = async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const user = await this.userService.getProfile(userId);
      return res.status(200).json(user);
    } catch (error: unknown) {
      if (error instanceof DatabaseError) {
        return res.status(404).json({ message: error.message });
      }
      return res.status(500).json({ message: 'Internal server error' });
    }
  };

  public updateProfile = async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const userData = req.body;
      const updatedUser = await this.userService.updateProfile(userId, userData);
      return res.status(200).json(updatedUser);
    } catch (error: unknown) {
      if (error instanceof DatabaseError) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: 'Internal server error' });
    }
  };

  public changePassword = async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Current password and new password are required' });
      }

      await this.userService.changePassword(userId, currentPassword, newPassword);
      return res.status(200).json({ message: 'Password updated successfully' });
    } catch (error: unknown) {
      if (error instanceof DatabaseError) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: 'Internal server error' });
    }
  };

  public forgotPassword = async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'El email es requerido'
        });
      }

      await this.userService.forgotPassword(email);
      return res.status(200).json({
        success: true,
        message: 'Se han enviado las instrucciones a tu correo electrónico'
      });
    } catch (error: unknown) {
      if (error instanceof DatabaseError) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  };

  public resetPassword = async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'El token y la nueva contraseña son requeridos'
        });
      }

      await this.userService.resetPassword(token, newPassword);
      return res.status(200).json({
        success: true,
        message: 'Contraseña actualizada exitosamente'
      });
    } catch (error: unknown) {
      if (error instanceof DatabaseError) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  };
}
