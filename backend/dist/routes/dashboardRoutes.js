"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const DashboardController_1 = require("../controllers/DashboardController");
const router = (0, express_1.Router)();
const dashboardController = new DashboardController_1.DashboardController();
// Rutas del dashboard
router.get('/income-expenses', (req, res) => dashboardController.getIncomeVsExpenses(req, res));
router.get('/category-expenses', (req, res) => dashboardController.getCategoryExpenses(req, res));
router.get('/recent-movements', (req, res) => dashboardController.getRecentMovements(req, res));
exports.default = router;
//# sourceMappingURL=dashboardRoutes.js.map