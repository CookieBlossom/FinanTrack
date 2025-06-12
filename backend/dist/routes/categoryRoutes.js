"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const CategoryController_1 = require("../controllers/CategoryController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = (0, express_1.Router)();
const categoryController = new CategoryController_1.CategoryController();
// Rutas protegidas
router.use(authMiddleware_1.authMiddleware);
router.get('/', categoryController.getAllCategories.bind(categoryController));
router.get('/user', categoryController.getUserCategories.bind(categoryController));
router.put('/:id/keywords', categoryController.updateUserCategoryKeywords.bind(categoryController));
router.put('/:id/color', categoryController.updateCategoryColor.bind(categoryController));
exports.default = router;
//# sourceMappingURL=categoryRoutes.js.map