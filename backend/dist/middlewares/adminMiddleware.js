"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminMiddleware = void 0;
const adminMiddleware = (req, res, next) => {
    if (!req.user) {
        res.status(401).json({ error: 'Usuario no autenticado' });
        return;
    }
    if (req.user.role !== 'admin') {
        res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de administrador' });
        return;
    }
    next();
};
exports.adminMiddleware = adminMiddleware;
//# sourceMappingURL=adminMiddleware.js.map