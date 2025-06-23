import { Router } from 'express';
import { DashboardController } from '../controllers/DashboardController';

const router = Router();
const dashboardController = new DashboardController();

// Rutas del dashboard
router.get('/income-expenses', dashboardController.getIncomeVsExpenses);
router.get('/category-expenses', dashboardController.getCategoryExpenses);
router.get('/recent-movements', dashboardController.getRecentMovements);

export default router; 