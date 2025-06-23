import { Router } from 'express';
import { CategoryController } from '../controllers/CategoryController';

const router = Router();
const categoryController = new CategoryController();
// Rutas protegidas
router.get('/', categoryController.getAllCategories.bind(categoryController));
router.get('/user', categoryController.getUserCategories.bind(categoryController));
router.put('/:id/keywords', categoryController.updateUserCategoryKeywords.bind(categoryController));
router.put('/:id/color', categoryController.updateCategoryColor.bind(categoryController));

export default router; 