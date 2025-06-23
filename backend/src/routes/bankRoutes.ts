import { Router } from 'express';
import { BankController } from '../controllers/BankController';

const router = Router();
const bankController = new BankController();

// Las rutas aquí ya están protegidas por authMiddleware desde routes/index.ts
router.get('/', bankController.getAllBanks);

export default router;