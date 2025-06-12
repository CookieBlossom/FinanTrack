import { Router } from 'express';
import { CategoryController } from '../controllers/CategoryController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();
const categoryController = new CategoryController();
// Rutas protegidas
router.use(authMiddleware);
router.get('/', categoryController.getAllCategories.bind(categoryController));
router.get('/user', categoryController.getUserCategories.bind(categoryController));
router.put('/:id/keywords', categoryController.updateUserCategoryKeywords.bind(categoryController));
router.put('/:id/color', categoryController.updateCategoryColor.bind(categoryController));

export default router; 