import { z } from 'zod';
import { ICardCreate, ICardUpdate } from '../interfaces/ICard';

export const cardSchema = z.object({
  nameAccount: z.string()
    .min(1, 'El nombre de la cuenta es requerido')
    .max(100, 'El nombre de la cuenta no puede exceder los 100 caracteres')
    .trim(),
  cardTypeId: z.number()
    .int('El tipo de tarjeta debe ser un número entero')
    .positive('El tipo de tarjeta debe ser un número positivo'),
  balance: z.number()
    .min(-999999999.99, 'El saldo no puede ser menor a -999,999,999.99')
    .max(999999999.99, 'El saldo no puede ser mayor a 999,999,999.99'),
  aliasAccount: z.string()
    .max(100, 'El alias no puede exceder los 100 caracteres')
    .trim()
    .optional(),
  currency: z.string()
    .length(3, 'El código de moneda debe tener exactamente 3 caracteres')
    .toUpperCase()
    .optional()
    .transform(val => val ?? 'CLP'),
  source: z.enum(['manual', 'scraper', 'imported', 'api'])
    .optional()
    .transform(val => val ?? 'manual'),
  bankId: z.number().optional().transform(val => (typeof val === 'number' ? val : undefined)),
}) satisfies z.ZodType<ICardCreate>;

export const cardUpdateSchema = cardSchema.partial().extend({
  statusAccount: z.enum(['active', 'inactive']).optional(),
  aliasAccount: z.string().max(100, 'El alias no puede exceder los 100 caracteres').trim().optional(),
  balance: z.number().min(-999999999.99).max(999999999.99).optional()
});