import { Router } from 'express';
import { ScraperController } from '../controllers/ScraperController';
// import { authMiddleware } from '../middlewares/authMiddleware'; // authMiddleware ya se aplica en index.ts para /scraper

const router = Router();
const scraperController = new ScraperController();
router.post('/task', scraperController.createTask);
router.get('/task/:taskId', scraperController.getTaskStatus); // Corregido de getTask a getTaskStatus
router.post('/task/:taskId/cancel', scraperController.cancelTask);
router.get('/tasks', scraperController.getUserTasks); // Obtener historial de tareas del usuario
router.post('/process-data', scraperController.processScraperData);
export default router; 