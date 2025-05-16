import { z } from 'zod';
import { ICardTypeCreate, ICardTypeUpdate } from '../interfaces/ICardType';

export const cardTypeSchema = z.object({
  name: z.string()
    .min(1, 'El nombre es requerido')
    .max(100, 'El nombre no puede exceder los 100 caracteres')
    .trim()
}) satisfies z.ZodType<ICardTypeCreate>;

export const cardTypeUpdateSchema = cardTypeSchema satisfies z.ZodType<ICardTypeUpdate>; 