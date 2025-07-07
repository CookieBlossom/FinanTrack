"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const DashboardController_1 = require("../controllers/DashboardController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = (0, express_1.Router)();
const dashboardController = new DashboardController_1.DashboardController();
// Rutas protegidas que requieren autenticación
router.use(authMiddleware_1.authMiddleware);
// Rutas del dashboard
router.get('/income-expenses', dashboardController.getIncomeVsExpenses);
router.get('/category-expenses', dashboardController.getCategoryExpenses);
router.get('/recent-movements', dashboardController.getRecentMovements);
router.get('/top-expenses', dashboardController.getTopExpenses);
router.get('/projected-movements', dashboardController.getProjectedMovements);
router.get('/expenses-by-category', dashboardController.getExpensesByCategory);
router.get('/financial-summary', dashboardController.getFinancialSummary);
// Ruta para procesar movimientos del scraper
router.post('/scraper/movements', dashboardController.processScraperMovements);
exports.default = router;
//# sourceMappingURL=dashboardRoutes.js.map