import { Router } from 'express';
import { GoalController } from '../controllers/GoalController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();
const goalController = new GoalController();

// Middleware de autenticación para todas las rutas de objetivos
router.use(authMiddleware);

// Obtener todos los objetivos del usuario autenticado
router.get('/', goalController.getAllGoals);

// Obtener objetivos por categoría
router.get('/category/:categoryId', goalController.getGoalsByCategory);

// Obtener un objetivo por ID
router.get('/:id', goalController.getGoalById);

// Crear un nuevo objetivo
router.post('/', goalController.createGoal);

// Actualizar un objetivo
router.put('/:id', goalController.updateGoal);

// Actualizar solo el progreso de un objetivo
router.patch('/:id/progress', goalController.updateGoalProgress);

// Eliminar un objetivo
router.delete('/:id', goalController.deleteGoal);

export default router; 