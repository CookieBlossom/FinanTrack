import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
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

// Aplicar middleware de autenticación a todas las rutas de movimientos
router.use(authMiddleware);
router.get('/', movementController.getAll);
router.get('/filter', movementController.getByFilters);
router.get('/:id', movementController.getById);
router.post('/', movementController.create);
router.put('/:id', movementController.update);
router.delete('/:id', movementController.delete);
router.post('/cartola', upload.single('cartola'), movementController.uploadCartola);

export default router; 