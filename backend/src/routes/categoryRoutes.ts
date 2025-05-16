import { Router } from 'express';
import { CategoryController } from '../controllers/CategoryController.js';

const router = Router();
const categoryController = new CategoryController();

// Obtener todas las categorías
router.get('/', categoryController.getAll);

// Buscar categorías por keyword
router.get('/search', categoryController.search);

// Obtener una categoría por ID
router.get('/:id', categoryController.getById);

// Crear una nueva categoría
router.post('/', categoryController.create);

// Actualizar una categoría
router.put('/:id', categoryController.update);

// Eliminar una categoría
router.delete('/:id', categoryController.delete);

export default router; 