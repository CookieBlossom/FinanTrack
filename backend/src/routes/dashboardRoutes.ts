import { Router } from 'express';
import { DashboardController } from '../controllers/DashboardController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();
const dashboardController = new DashboardController();

// Rutas protegidas que requieren autenticación
router.use(authMiddleware);

// Rutas del dashboard
router.get('/income-expenses', dashboardController.getIncomeVsExpenses);
router.get('/category-expenses', dashboardController.getCategoryExpenses);
router.get('/recent-movements', dashboardController.getRecentMovements);
router.get('/top-expenses', dashboardController.getTopExpenses);
router.get('/projected-movements', dashboardController.getProjectedMovements);
router.get('/expenses-by-category', dashboardController.getExpensesByCategory);
router.get('/financial-summary', dashboardController.getFinancialSummary);

// Ruta para procesar movimientos del scraper
router.post('/scraper/movements', dashboardController.processScraperMovements);

export default router; 