import { Router } from 'express';
import { CartolaController } from '../controllers/CartolaController';
import multer from 'multer';

const router = Router();
const cartolaController = new CartolaController();

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

// Ruta para subir cartola
router.post(
  '/upload',
  upload.single('cartola'),
  cartolaController.uploadCartola
);

export default router; 