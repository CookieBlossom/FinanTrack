import { Request, Response } from 'express';
import { CategoryService } from '../services/category.service';
import { AuthRequest } from '../interfaces/AuthRequest';

export class CategoryController {
    private categoryService = new CategoryService();
    async getAllCategories(req: Request, res: Response) {
      try {
        const categories = await this.categoryService.getAllCategories();
        res.json(categories);
      } catch (error) {
        res.status(500).json({ error: 'Error al obtener categorías' });
      }
    }
  
    // Devuelve categorías + keywords para usuario autenticado
    async getUserCategories(req: AuthRequest, res: Response) {
      try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Usuario no autenticado' });
        const categories = await this.categoryService.getUserCategories(userId);
        res.json(categories);
      } catch (error) {
        res.status(500).json({ error: 'Error al obtener categorías del usuario' });
      }
    }
  
    // Actualizar keywords personalizadas
    async updateUserCategoryKeywords(req: AuthRequest, res: Response) {
      try {
        const userId = req.user?.id;
        const categoryId = parseInt(req.params.id);
        const { keywords } = req.body;
        if (!userId || isNaN(categoryId)) {
          return res.status(400).json({ error: 'Datos inválidos' });
        }
        await this.categoryService.updateUserCategoryKeywords(userId, categoryId, keywords);
        res.json({ message: 'Palabras clave actualizadas correctamente' });
      } catch (error) {
        res.status(500).json({ error: 'Error al actualizar las palabras clave' });
      }
    }
  
    // Actualizar color de categoría global
    async updateCategoryColor(req: AuthRequest, res: Response) {
      try {
        const categoryId = parseInt(req.params.id);
        const { color } = req.body;
        if (!color || isNaN(categoryId)) {
          return res.status(400).json({ error: 'Datos inválidos' });
        }
        await this.categoryService.updateCategoryColor(categoryId, color);
        res.json({ message: 'Color actualizado correctamente' });
      } catch (error) {
        res.status(500).json({ error: 'Error al actualizar el color' });
      }
    }
}