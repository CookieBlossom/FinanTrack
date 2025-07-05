"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionalAuthMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const optionalAuthMiddleware = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            // No hay token, continuar sin autenticación
            next();
            return;
        }
        const token = authHeader.split(' ')[1]; // Bearer TOKEN
        if (!token) {
            // Token inválido, continuar sin autenticación
            next();
            return;
        }
        try {
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || '2004');
            // Asegurar que el token decodificado tenga un rol
            if (!decoded.role) {
                decoded.role = 'user'; // Rol por defecto
            }
            if (!decoded.name) {
                decoded.name = decoded.email;
            }
            req.user = decoded;
            next();
        }
        catch (error) {
            // Token inválido o expirado, continuar sin autenticación
            next();
        }
    }
    catch (error) {
        // Error general, continuar sin autenticación
        next();
    }
};
exports.optionalAuthMiddleware = optionalAuthMiddleware;
//# sourceMappingURL=optionalAuthMiddleware.js.map