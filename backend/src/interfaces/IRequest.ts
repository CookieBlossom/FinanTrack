import { Request } from 'express';
import { IUserToken } from '../interfaces/IUser';

export interface AuthRequest extends Request {
    user?: IUserToken;
  }