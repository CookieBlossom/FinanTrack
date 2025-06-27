import { Router } from 'express';
import { MovementController } from '../controllers/MovementController';
import multer from 'multer';

const router = Router();
const movementController = new MovementController();

// Configurar multer para manejar archivos PDF
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // Límite de 5MB
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(null, false);
      cb(new Error('Solo se permiten archivos PDF'));
    }
  },
});

// Las rutas aquí ya están protegidas por authMiddleware desde routes/index.ts
router.get('/', movementController.getAll);
router.get('/cash', movementController.getCashMovements);
router.get('/card-movements', movementController.getCardMovements);
router.get('/filter', movementController.getByFilters);
router.get('/monthly-summary', movementController.getMonthlySummary);
router.get('/:id', movementController.getById);
router.post('/', movementController.create);
router.put('/:id', movementController.update);
router.delete('/:id', movementController.delete);
router.post('/cartola', upload.single('cartola'), movementController.uploadCartola);

export default router; 