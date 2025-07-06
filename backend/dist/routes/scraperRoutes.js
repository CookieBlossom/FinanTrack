"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ScraperController_1 = require("../controllers/ScraperController");
// import { authMiddleware } from '../middlewares/authMiddleware'; // authMiddleware ya se aplica en index.ts para /scraper
const router = (0, express_1.Router)();
const scraperController = new ScraperController_1.ScraperController();
router.post('/task', scraperController.createTask);
router.get('/task/:taskId', scraperController.getTaskStatus); // Corregido de getTask a getTaskStatus
router.post('/task/:taskId/cancel', scraperController.cancelTask);
router.get('/tasks', scraperController.getUserTasks); // Obtener historial de tareas del usuario
router.post('/process-data', scraperController.processScraperData);
exports.default = router;
//# sourceMappingURL=scraperRoutes.js.map