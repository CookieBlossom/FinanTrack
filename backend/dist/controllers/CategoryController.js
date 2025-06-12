"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategoryController = void 0;
const category_service_1 = require("../services/category.service");
class CategoryController {
    constructor() {
        this.categoryService = new category_service_1.CategoryService();
    }
    async getAllCategories(req, res) {
        try {
            const categories = await this.categoryService.getAllCategories();
            res.json(categories);
        }
        catch (error) {
            res.status(500).json({ error: 'Error al obtener categorías' });
        }
    }
    // Devuelve categorías + keywords para usuario autenticado
    async getUserCategories(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId)
                return res.status(401).json({ error: 'Usuario no autenticado' });
            const categories = await this.categoryService.getUserCategories(userId);
            res.json(categories);
        }
        catch (error) {
            res.status(500).json({ error: 'Error al obtener categorías del usuario' });
        }
    }
    // Actualizar keywords personalizadas
    async updateUserCategoryKeywords(req, res) {
        try {
            const userId = req.user?.id;
            const categoryId = parseInt(req.params.id);
            const { keywords } = req.body;
            if (!userId || isNaN(categoryId)) {
                return res.status(400).json({ error: 'Datos inválidos' });
            }
            await this.categoryService.updateUserCategoryKeywords(userId, categoryId, keywords);
            res.json({ message: 'Palabras clave actualizadas correctamente' });
        }
        catch (error) {
            res.status(500).json({ error: 'Error al actualizar las palabras clave' });
        }
    }
    // Actualizar color de categoría global
    async updateCategoryColor(req, res) {
        try {
            const categoryId = parseInt(req.params.id);
            const { color } = req.body;
            if (!color || isNaN(categoryId)) {
                return res.status(400).json({ error: 'Datos inválidos' });
            }
            await this.categoryService.updateCategoryColor(categoryId, color);
            res.json({ message: 'Color actualizado correctamente' });
        }
        catch (error) {
            res.status(500).json({ error: 'Error al actualizar el color' });
        }
    }
}
exports.CategoryController = CategoryController;
//# sourceMappingURL=CategoryController.js.map