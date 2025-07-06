"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const DashboardController_1 = require("../controllers/DashboardController");
const router = (0, express_1.Router)();
const dashboardController = new DashboardController_1.DashboardController();
// Rutas del dashboard
router.get('/income-expenses', dashboardController.getIncomeVsExpenses);
router.get('/category-expenses', dashboardController.getCategoryExpenses);
router.get('/recent-movements', dashboardController.getRecentMovements);
router.get('/top-expenses', dashboardController.getTopExpenses);
router.get('/financial-summary', dashboardController.getFinancialSummary);
// Ruta para procesar movimientos del scraper
router.post('/scraper/movements', dashboardController.processScraperMovements);
exports.default = router;
//# sourceMappingURL=dashboardRoutes.js.map