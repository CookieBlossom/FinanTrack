import { Router } from 'express';
import { ScraperController } from '../controllers/ScraperController';
// import { authMiddleware } from '../middlewares/authMiddleware'; // authMiddleware ya se aplica en index.ts para /scraper

const router = Router();
const scraperController = new ScraperController();
router.post('/task', scraperController.createTask);
router.get('/task/:taskId', scraperController.getTaskStatus); // Corregido de getTask a getTaskStatus
router.post('/task/:taskId/cancel', scraperController.cancelTask);
router.get('/tasks', scraperController.getUserTasks); // Obtener historial de tareas del usuario

// --- Rutas Antiguas/No Implementadas en el ScraperController actual ---
// Se comentan porque ScraperController fue simplificado para enfocarse en el flujo de Banco Estado.
// Para reactivarlas, ScraperController necesitaría implementar los métodos correspondientes
// y potencialmente interactuar con un GeneralScraperService más completo.

// router.get('/tasks', scraperController.getAllTasks); // Método no implementado en ScraperController actual (ahora implementado como getUserTasks)
// router.get('/status', scraperController.getScraperStatus); // Método no implementado
// router.post('/cleanup', scraperController.cleanupTasks); // Método no implementado

// Las siguientes rutas modificaban req.body y llamaban a createTask.
// El createTask actual es específico para banco-estado y no usa req.body.type de la misma manera.
/*
router.post('/banco-estado/saldos', (req, res) => {
  // req.body.type = 'saldos'; // El ScraperController.createTask actual no usa 'type'
  req.body.site = 'banco-estado'; // El ScraperController.createTask actual toma esto del body
  return scraperController.createTask(req, res);
});

router.post('/banco-estado/movimientos', (req, res) => {
  // req.body.type = 'movimientos';
  req.body.site = 'banco-estado';
  return scraperController.createTask(req, res);
});
*/

// router.post('/banco-estado/sync', scraperController.executeBancoEstadoScraper); // Método no implementado (funcionalidad ahora en POST /task)

export default router; 