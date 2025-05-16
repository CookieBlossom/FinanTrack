import { Router } from 'express';
import { BudgetController } from '../controllers/BudgetController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();
const budgetController = new BudgetController();

// Middleware de autenticación para todas las rutas de presupuestos
router.use(authMiddleware);

// Obtener todos los presupuestos del usuario autenticado
router.get('/', budgetController.getAllBudgets);

// Obtener presupuestos con información de gasto actual
router.get('/with-spending', budgetController.getAllBudgetsWithSpending);

// Obtener presupuestos por estado
router.get('/status/:status', budgetController.getBudgetsByStatus);

// Obtener presupuestos por categoría
router.get('/category/:categoryId', budgetController.getBudgetsByCategory);

// Obtener un presupuesto por ID
router.get('/:id', budgetController.getBudgetById);

// Crear un nuevo presupuesto
router.post('/', budgetController.createBudget);

// Actualizar un presupuesto
router.put('/:id', budgetController.updateBudget);

// Eliminar un presupuesto
router.delete('/:id', budgetController.deleteBudget);

export default router; 