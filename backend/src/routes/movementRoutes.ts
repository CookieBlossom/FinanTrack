import { Router } from 'express';
import { MovementController } from '../controllers/movementController';

const router = Router();
const movementController = new MovementController();

// Obtener todos los movimientos
router.get('/', movementController.getAll);

// Obtener movimientos filtrados
router.get('/filter', movementController.getByFilters);

// Obtener un movimiento por ID
router.get('/:id', movementController.getById);

// Crear un nuevo movimiento
router.post('/', movementController.create);

// Actualizar un movimiento
router.put('/:id', movementController.update);

// Eliminar un movimiento
router.delete('/:id', movementController.delete);

export default router; 