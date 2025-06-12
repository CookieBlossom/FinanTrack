import { Router } from 'express';
import { DashboardController } from '../controllers/DashboardController';

const router = Router();
const dashboardController = new DashboardController();

// Rutas del dashboard
router.get('/income-expenses', (req, res) => dashboardController.getIncomeVsExpenses(req, res));
router.get('/category-expenses', (req, res) => dashboardController.getCategoryExpenses(req, res));
router.get('/recent-movements', (req, res) => dashboardController.getRecentMovements(req, res));

export default router; 