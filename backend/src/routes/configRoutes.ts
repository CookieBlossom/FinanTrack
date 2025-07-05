import { Router } from 'express';
import { ConfigController } from '../controllers/ConfigController';

const router = Router();
const configController = new ConfigController();

// Ruta para obtener la configuración de companies.json
router.get('/companies', configController.getCompanies);

export default router; 