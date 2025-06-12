"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const userRoutes_1 = __importDefault(require("./userRoutes"));
const cardTypeRoutes_1 = __importDefault(require("./cardTypeRoutes"));
const cardRoutes_1 = __importDefault(require("./cardRoutes"));
const projectedMovementRoutes_1 = __importDefault(require("./projectedMovementRoutes"));
const scraperRoutes_1 = __importDefault(require("./scraperRoutes"));
const dashboardRoutes_1 = __importDefault(require("./dashboardRoutes"));
const analyticsRoutes_1 = __importDefault(require("./analyticsRoutes"));
const cartola_routes_1 = __importDefault(require("./cartola.routes"));
const authMiddleware_1 = require("../middlewares/authMiddleware");
const bankRoutes_1 = __importDefault(require("./bankRoutes"));
const movementRoutes_1 = __importDefault(require("./movementRoutes"));
const categoryRoutes_1 = __importDefault(require("./categoryRoutes"));
const router = (0, express_1.Router)();
const protectedRouter = (0, express_1.Router)();
// Aplicar middleware de autenticación a todas las rutas protegidas
protectedRouter.use(authMiddleware_1.authMiddleware);
// Rutas públicas (no requieren autenticación)
router.use('/users', userRoutes_1.default);
// Ruta de prueba para verificar que el router está funcionando
router.get('/', (req, res) => {
    res.json({ message: 'backend funcionando correctamente' });
});
// Rutas protegidas (requieren autenticación)
protectedRouter.use('/cards', cardRoutes_1.default);
protectedRouter.use('/cartolas', cartola_routes_1.default);
protectedRouter.use('/card-types', cardTypeRoutes_1.default);
protectedRouter.use('/categories', categoryRoutes_1.default);
protectedRouter.use('/projected-movements', projectedMovementRoutes_1.default);
protectedRouter.use('/scraper', scraperRoutes_1.default);
protectedRouter.use('/dashboard', dashboardRoutes_1.default);
protectedRouter.use('/analytics', analyticsRoutes_1.default);
protectedRouter.use('/banks', bankRoutes_1.default);
protectedRouter.use('/movements', movementRoutes_1.default);
// Montar las rutas protegidas bajo /api
router.use('/', protectedRouter);
exports.default = router;
//# sourceMappingURL=index.js.map