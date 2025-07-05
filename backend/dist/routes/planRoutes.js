"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const PlanController_1 = require("../controllers/PlanController");
const router = (0, express_1.Router)();
const controller = new PlanController_1.PlanController();
router.get('/', controller.getPlan);
router.get('/limits', controller.getLimits);
router.get('/permissions', controller.getPermissions);
router.get('/usage', controller.getUsage);
exports.default = router;
//# sourceMappingURL=planRoutes.js.map