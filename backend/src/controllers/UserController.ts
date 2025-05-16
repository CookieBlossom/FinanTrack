import { Response } from 'express';
import { UserService } from '../services/UserService';
import { IUserLogin, IUserRegister } from '../interfaces/IUser';
import { AuthRequest } from '../interfaces/IAuth';
import { DatabaseError } from '../utils/errors';

export class UserController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  public register = async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const userData: IUserRegister = req.body;
      const user = await this.userService.register(userData);
      return res.status(201).json(user);
    } catch (error: unknown) {
      if (error instanceof DatabaseError) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: 'Internal server error' });
    }
  };

  public login = async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const credentials: IUserLogin = req.body;
      const result = await this.userService.login(credentials);
      return res.status(200).json(result);
    } catch (error: unknown) {
      if (error instanceof DatabaseError) {
        return res.status(401).json({ message: error.message });
      }
      return res.status(500).json({ message: 'Internal server error' });
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
}
