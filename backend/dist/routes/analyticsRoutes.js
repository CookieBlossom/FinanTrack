"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const AnalyticsController_1 = require("../controllers/AnalyticsController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = (0, express_1.Router)();
const analyticsController = new AnalyticsController_1.AnalyticsController();
// Todas las rutas requieren autenticación
router.use(authMiddleware_1.authMiddleware);
// Obtener datos de analytics
// router.get('/', (req, res) => analyticsController.getAnalyticsData(req, res));
exports.default = router;
//# sourceMappingURL=analyticsRoutes.js.map