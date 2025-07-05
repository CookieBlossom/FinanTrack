"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRut = validateRut;
/**
 * Valida el formato de un RUT chileno
 * @param rut RUT a validar (formato: 12345678-9 o 1234567-8)
 * @returns boolean indicando si el RUT es válido
 */
function validateRut(rut) {
    try {
        // Eliminar puntos y guiones
        const cleanRut = rut.replace(/[.-]/g, '');
        const dv = cleanRut.slice(-1).toUpperCase();
        const rutBody = cleanRut.slice(0, -1);
        if (!/^\d{7,8}$/.test(rutBody)) {
            return false;
        }
        if (!/^[0-9K]$/i.test(dv)) {
            return false;
        }
        // Calcular dígito verificador
        let sum = 0;
        let multiplier = 2;
        // Recorrer el RUT de derecha a izquierda
        for (let i = rutBody.length - 1; i >= 0; i--) {
            sum += parseInt(rutBody[i]) * multiplier;
            multiplier = multiplier === 7 ? 2 : multiplier + 1;
        }
        const expectedDv = 11 - (sum % 11);
        let calculatedDv;
        if (expectedDv === 11) {
            calculatedDv = '0';
        }
        else if (expectedDv === 10) {
            calculatedDv = 'K';
        }
        else {
            calculatedDv = expectedDv.toString();
        }
        return calculatedDv === dv.toUpperCase();
    }
    catch (error) {
        console.error('Error validando RUT:', error);
        return false;
    }
}
//# sourceMappingURL=validators.js.map