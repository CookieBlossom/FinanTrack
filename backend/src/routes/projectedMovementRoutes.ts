import { Router } from 'express';
import { ProjectedMovementController } from '../controllers/ProjectedMovementController';

const router = Router();
const controller = new ProjectedMovementController();

// Las rutas aquí ya están protegidas por authMiddleware desde routes/index.ts
router.get('/intelligent', controller.getIntelligent);
router.get('/', controller.getAll);
router.get('/filter', controller.getByFilters);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.delete);

export default router; 