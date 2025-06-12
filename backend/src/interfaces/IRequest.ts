import { Request } from 'express';
import { TokenPayload } from './AuthRequest';
import { IUserToken } from '../interfaces/IUser';

export interface AuthRequest extends Request {
    user?: IUserToken;
  }