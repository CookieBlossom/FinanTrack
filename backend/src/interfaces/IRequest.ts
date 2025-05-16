import { Request } from 'express';

export interface IUser {
    id: number;
    email: string;
    name: string;
}

export interface IAuthRequest extends Request {
    user?: IUser;
} 