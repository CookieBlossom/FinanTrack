"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ProjectedMovementController_1 = require("../controllers/ProjectedMovementController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = (0, express_1.Router)();
const projectedMovementController = new ProjectedMovementController_1.ProjectedMovementController();
// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware_1.authMiddleware);
// Obtener todos los movimientos proyectados
router.get('/', projectedMovementController.getAll);
// Obtener movimientos proyectados por filtros
router.get('/filter', projectedMovementController.getByFilters);
// Obtener un movimiento proyectado por ID
router.get('/:id', projectedMovementController.getById);
// Crear un nuevo movimiento proyectado
router.post('/', projectedMovementController.create);
// Actualizar un movimiento proyectado
router.put('/:id', projectedMovementController.update);
// Eliminar un movimiento proyectado
router.delete('/:id', projectedMovementController.delete);
exports.default = router;
//# sourceMappingURL=projectedMovementRoutes.js.map