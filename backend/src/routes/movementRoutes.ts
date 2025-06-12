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

// Obtener todos los movimientos
router.get('/', movementController.getAll);

// Obtener movimientos filtrados
router.get('/filter', movementController.getByFilters);

// Obtener un movimiento por ID
router.get('/:id', movementController.getById);

// Crear un nuevo movimiento
router.post('/', movementController.create);

// Actualizar un movimiento
router.put('/:id', movementController.update);

// Eliminar un movimiento
router.delete('/:id', movementController.delete);

// Nueva ruta para procesar cartolas
router.post('/cartola', upload.single('cartola'), movementController.uploadCartola);

export default router; 