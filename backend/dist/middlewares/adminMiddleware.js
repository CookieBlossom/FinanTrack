"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminMiddleware = void 0;
const adminMiddleware = async (req, res, next) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Usuario no autenticado' });
            return;
        }
        if (req.user.role !== 'admin') {
            res.status(403).json({ error: 'Acceso denegado: se requieren privilegios de administrador' });
            return;
        }
        next();
    }
    catch (error) {
        next(error);
    }
};
exports.adminMiddleware = adminMiddleware;
//# sourceMappingURL=adminMiddleware.js.map