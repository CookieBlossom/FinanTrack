"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cardUpdateSchema = exports.cardSchema = void 0;
const zod_1 = require("zod");
exports.cardSchema = zod_1.z.object({
    nameAccount: zod_1.z.string()
        .min(1, 'El nombre de la cuenta es requerido')
        .max(100, 'El nombre de la cuenta no puede exceder los 100 caracteres')
        .trim(),
    cardTypeId: zod_1.z.number()
        .int('El tipo de tarjeta debe ser un número entero')
        .positive('El tipo de tarjeta debe ser un número positivo'),
    balance: zod_1.z.number()
        .min(-999999999.99, 'El saldo no puede ser menor a -999,999,999.99')
        .max(999999999.99, 'El saldo no puede ser mayor a 999,999,999.99'),
    aliasAccount: zod_1.z.string()
        .max(100, 'El alias no puede exceder los 100 caracteres')
        .trim()
        .optional(),
    currency: zod_1.z.string()
        .length(3, 'El código de moneda debe tener exactamente 3 caracteres')
        .toUpperCase()
        .optional()
        .transform(val => val ?? 'CLP'),
    source: zod_1.z.enum(['manual', 'scraper', 'imported', 'api'])
        .optional()
        .transform(val => val ?? 'manual'),
    bankId: zod_1.z.number().optional().transform(val => (typeof val === 'number' ? val : undefined)),
});
exports.cardUpdateSchema = exports.cardSchema.partial().extend({
    statusAccount: zod_1.z.enum(['active', 'inactive']).optional(),
    aliasAccount: zod_1.z.string().max(100, 'El alias no puede exceder los 100 caracteres').trim().optional(),
    balance: zod_1.z.number().min(-999999999.99).max(999999999.99).optional()
});
//# sourceMappingURL=cardSchema.js.map