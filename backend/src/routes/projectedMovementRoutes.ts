import { Router } from 'express';
import { ProjectedMovementController } from '../controllers/ProjectedMovementController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();
const projectedMovementController = new ProjectedMovementController();

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware);

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

export default router; 