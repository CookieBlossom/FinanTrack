"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const PlansPageController_1 = require("../controllers/PlansPageController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const optionalAuthMiddleware_1 = require("../middlewares/optionalAuthMiddleware");
const router = (0, express_1.Router)();
const controller = new PlansPageController_1.PlansPageController();
// Rutas públicas (no requieren autenticación)
router.get('/plans', controller.getPlansInfo);
// Ruta que verifica autenticación opcional
router.get('/auth-status', optionalAuthMiddleware_1.optionalAuthMiddleware, controller.checkAuthStatus);
// Rutas protegidas (requieren autenticación)
router.post('/initiate-payment', authMiddleware_1.authMiddleware, controller.initiatePayment);
router.post('/confirm-payment', authMiddleware_1.authMiddleware, controller.confirmPayment);
exports.default = router;
//# sourceMappingURL=plansPageRoutes.js.map