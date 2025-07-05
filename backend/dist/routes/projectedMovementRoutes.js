"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ProjectedMovementController_1 = require("../controllers/ProjectedMovementController");
const router = (0, express_1.Router)();
const controller = new ProjectedMovementController_1.ProjectedMovementController();
// Las rutas aquí ya están protegidas por authMiddleware desde routes/index.ts
router.get('/intelligent', controller.getIntelligent);
router.get('/', controller.getAll);
router.get('/filter', controller.getByFilters);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.delete);
exports.default = router;
//# sourceMappingURL=projectedMovementRoutes.js.map