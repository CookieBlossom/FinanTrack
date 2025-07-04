import { Router } from 'express';
import { DashboardController } from '../controllers/DashboardController';

const router = Router();
const dashboardController = new DashboardController();

// Rutas del dashboard
router.get('/income-expenses', dashboardController.getIncomeVsExpenses);
router.get('/category-expenses', dashboardController.getCategoryExpenses);
router.get('/recent-movements', dashboardController.getRecentMovements);

// Ruta para procesar movimientos del scraper
router.post('/scraper/movements', dashboardController.processScraperMovements);

// Ruta especial para el scraper sin autenticación
router.post('/scraper/process-data', dashboardController.processScraperData);

export default router; 