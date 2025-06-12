import { Request } from 'express';
import { IUser } from './IUser';

export interface LoginResponse {
  token: string;
  user: Omit<IUser, 'password'>;
}

export interface RefreshTokenPayload {
  id: number;
  tokenVersion: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
} 