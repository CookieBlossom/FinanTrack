"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const AutomationController_1 = require("../controllers/AutomationController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = (0, express_1.Router)();
const automationController = new AutomationController_1.AutomationController();
// Rutas públicas (para cron jobs)
router.post('/run-scheduled', automationController.runScheduledProcessing);
// Rutas protegidas (requieren autenticación)
router.use(authMiddleware_1.authMiddleware);
// Obtener estadísticas de automatización
router.get('/stats', automationController.getStats);
// Procesar movimientos del usuario actual
router.post('/process-user', automationController.processUserMovements);
exports.default = router;
//# sourceMappingURL=automationRoutes.js.map