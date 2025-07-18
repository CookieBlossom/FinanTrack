"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cardUpdateSchema = exports.cardSchema = void 0;
const zod_1 = require("zod");
// Función para validar RUT chileno
function validateRut(rut) {
    if (!rut)
        return false;
    // Limpiar el RUT de puntos y guión
    const cleanRut = rut.replace(/[.-]/g, '');
    // Verificar formato básico
    if (!/^\d{7,8}[0-9K]$/i.test(cleanRut)) {
        return false;
    }
    // Separar cuerpo y dígito verificador
    const body = cleanRut.slice(0, -1);
    const dv = cleanRut.slice(-1).toUpperCase();
    // Calcular dígito verificador
    let sum = 0;
    let multiplier = 2;
    // Sumar cada dígito multiplicado por su factor
    for (let i = body.length - 1; i >= 0; i--) {
        sum += parseInt(body[i]) * multiplier;
        multiplier = multiplier === 7 ? 2 : multiplier + 1;
    }
    // Calcular dígito verificador esperado
    const expectedDv = 11 - (sum % 11);
    const calculatedDv = expectedDv === 11 ? '0' : expectedDv === 10 ? 'K' : expectedDv.toString();
    return calculatedDv === dv;
}
// Schema base para la creación de tarjetas
const baseSchema = {
    nameAccount: zod_1.z.string()
        .min(1, 'El nombre de la cuenta es requerido')
        .max(100, 'El nombre de la cuenta no puede exceder los 100 caracteres')
        .trim(),
    accountHolder: zod_1.z.string()
        .max(255, 'El titular de la cuenta no puede exceder los 255 caracteres')
        .optional(),
    cardTypeId: zod_1.z.number()
        .int('El tipo de tarjeta debe ser un número entero')
        .positive('El tipo de tarjeta debe ser un número positivo'),
    balance: zod_1.z.number()
        .min(-999999999.99, 'El saldo no puede ser menor a -999,999,999.99')
        .max(999999999.99, 'El saldo no puede ser mayor a 999,999,999.99'),
    currency: zod_1.z.string()
        .length(3, 'El código de moneda debe tener exactamente 3 caracteres')
        .toUpperCase()
        .optional()
        .transform(val => val ?? 'CLP'),
    source: zod_1.z.enum(['manual', 'scraper', 'imported', 'api'])
        .optional()
        .transform(val => val ?? 'manual'),
    bankId: zod_1.z.number()
        .int('El ID del banco debe ser un número entero')
        .positive('El ID del banco debe ser un número positivo')
        .optional(),
    userId: zod_1.z.number()
        .int('El ID del usuario debe ser un número entero')
        .positive('El ID del usuario debe ser un número positivo')
        .optional()
};
exports.cardSchema = zod_1.z.object(baseSchema).refine((data) => {
    // Si es CuentaRUT, validar el nombre y banco
    if (data.cardTypeId === 9) {
        const nameValid = data.nameAccount.toUpperCase() === 'CUENTA RUT' || validateRut(data.nameAccount);
        const bankValid = data.bankId === 1;
        return nameValid && bankValid;
    }
    return true;
}, {
    message: 'Para CuentaRUT: el nombre debe ser "CUENTA RUT" o un RUT válido, y el banco debe ser BancoEstado',
    path: ['nameAccount', 'bankId']
});
// Schema para actualización de tarjetas
const updateSchema = zod_1.z.object({
    nameAccount: baseSchema.nameAccount.optional(),
    accountHolder: baseSchema.accountHolder.optional(),
    cardTypeId: baseSchema.cardTypeId.optional(),
    balance: baseSchema.balance.optional(),
    currency: baseSchema.currency.optional(),
    source: baseSchema.source.optional(),
    bankId: baseSchema.bankId.optional(),
    statusAccount: zod_1.z.enum(['active', 'inactive']).optional()
});
exports.cardUpdateSchema = updateSchema.refine((data) => {
    // Si se está actualizando a CuentaRUT, validar el nombre y banco
    if (data.cardTypeId === 9) {
        if (data.nameAccount && !validateRut(data.nameAccount) && data.nameAccount.toUpperCase() !== 'CUENTA RUT') {
            return false;
        }
        if (data.bankId !== undefined && data.bankId !== 1) {
            return false;
        }
    }
    return true;
}, {
    message: 'Para CuentaRUT: el nombre debe ser "CUENTA RUT" o un RUT válido, y el banco debe ser BancoEstado',
    path: ['nameAccount', 'bankId']
});
//# sourceMappingURL=cardSchema.js.map