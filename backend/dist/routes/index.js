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
const planRoutes_1 = __importDefault(require("./planRoutes"));
const plansPageRoutes_1 = __importDefault(require("./plansPageRoutes"));
const stripeRoutes_1 = __importDefault(require("./stripeRoutes"));
const automationRoutes_1 = __importDefault(require("./automationRoutes"));
const configRoutes_1 = __importDefault(require("./configRoutes"));
const ScraperController_1 = require("../controllers/ScraperController");
const router = (0, express_1.Router)();
const protectedRouter = (0, express_1.Router)();
const scraperController = new ScraperController_1.ScraperController();
// Rutas públicas
router.use('/users', userRoutes_1.default);
router.use('/plans-page', plansPageRoutes_1.default);
router.use('/stripe', stripeRoutes_1.default);
router.use('/automation', automationRoutes_1.default);
router.use('/config', configRoutes_1.default);
router.post('/scraper/process-data', scraperController.processScraperData);
router.get('/', (req, res) => {
    res.json({ message: 'rutas publicas funcionando correctamente' });
});
// Rutas protegidas
protectedRouter.use(authMiddleware_1.authMiddleware);
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
protectedRouter.use('/plans', planRoutes_1.default);
protectedRouter.get('/', (req, res) => {
    res.json({ message: 'rutas protegidas funcionando correctamente' });
});
router.use('/', protectedRouter);
exports.default = router;
//# sourceMappingURL=index.js.map