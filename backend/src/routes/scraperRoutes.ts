import { Router } from 'express';
import { ScraperController } from '../controllers/ScraperController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();
const scraperController = new ScraperController();

// Todas las rutas del scraper requieren autenticación
router.use(authMiddleware);

// Rutas de scraper generales
router.post('/task', scraperController.startScraping);
router.get('/task/:taskId', scraperController.getTaskStatus);
router.get('/tasks', scraperController.getAllTasks);
router.get('/status', scraperController.getScraperStatus);
router.post('/cleanup', scraperController.cleanupTasks); // Solo para admins

// Rutas específicas para diferentes tipos de scrapers
router.post('/banco-estado/saldos', scraperController.startSaldosScraping);
router.post('/banco-estado/movimientos-recientes', scraperController.startMovimientosRecientesScraping);

export default router; 