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
// Ruta para procesar movimientos del scraper
router.post('/scraper/movements', dashboardController.processScraperMovements);
// Ruta especial para el scraper sin autenticación
router.post('/scraper/process-data', dashboardController.processScraperData);
exports.default = router;
//# sourceMappingURL=dashboardRoutes.js.map