import { Router } from 'express';
import { BankController } from '../controllers/BankController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();
const bankController = new BankController();

router.use(authMiddleware);

// Obtener todos los bancos
router.get('/', bankController.getAllBanks);

export default router;