import { Router } from 'express';
import { ProjectedMovementController } from '../controllers/ProjectedMovementController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();
const projectedMovementController = new ProjectedMovementController();

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware);
router.get('/', projectedMovementController.getAll);
router.get('/filter', projectedMovementController.getByFilters);
router.get('/:id', projectedMovementController.getById);
router.post('/', projectedMovementController.create);
router.put('/:id', projectedMovementController.update);
router.delete('/:id', projectedMovementController.delete);

export default router; 