"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const AnalyticsController_1 = require("../controllers/AnalyticsController");
const router = (0, express_1.Router)();
const analyticsController = new AnalyticsController_1.AnalyticsController();
// Las rutas aquí ya están protegidas por authMiddleware desde routes/index.ts
router.get('/month/:year/:month', analyticsController.getAnalyticsByMonth);
router.get('/', analyticsController.getAnalytics);
exports.default = router;
//# sourceMappingURL=analyticsRoutes.js.map