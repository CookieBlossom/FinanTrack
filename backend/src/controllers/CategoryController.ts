import { Request, Response, NextFunction } from 'express';
import { CategoryService } from '../services/category.service';
import { AuthRequest } from '../interfaces/AuthRequest';

export class CategoryController {
    private categoryService = new CategoryService();
    
    public async getAllCategories(req: Request, res: Response, next: NextFunction) {
      try {
        const categories = await this.categoryService.getAllCategories();
        res.json(categories);
      } catch (error) {
        res.status(500).json({ error: 'Error al obtener categorías' });
      }
    }
  
    // Devuelve categorías + keywords para usuario autenticado
    public async getUserCategories(req: Request, res: Response, next: NextFunction) {
      try {
        const userId = (req as AuthRequest).user?.id;
        if (!userId) return res.status(401).json({ error: 'Usuario no autenticado' });
        
        console.log('Usuario autenticado:', (req as AuthRequest).user);
        
        const categories = await this.categoryService.getUserCategories(userId);
        res.json(categories);
      } catch (error) {
        console.error('Error en getUserCategories:', error);
        res.status(500).json({ error: 'Error al obtener categorías del usuario' });
      }
    }
  
    // Actualizar keywords personalizadas
    public async updateUserCategoryKeywords(req: Request, res: Response, next: NextFunction) {
      try {
        const user = (req as AuthRequest).user;
        if (!user) {
          return res.status(401).json({ error: 'Usuario no autenticado' });
        }
        
        const categoryId = parseInt(req.params.id);
        const { keywords } = req.body;
        
        console.log('Datos recibidos:', { userId: user.id, categoryId, keywords, planId: user.planId });
        
        if (isNaN(categoryId) || !Array.isArray(keywords)) {
          return res.status(400).json({ error: 'Datos inválidos' });
        }
        
        await this.categoryService.updateUserCategoryKeywords(user.id, categoryId, keywords, user.planId);
        res.json({ message: 'Palabras clave actualizadas correctamente' });
      } catch (error) {
        console.error('Error en updateUserCategoryKeywords:', error);
        
        if (error instanceof Error && error.message.includes('límite')) {
          res.status(403).json({ error: error.message });
        } else {
          res.status(500).json({ 
            error: 'Error al actualizar las palabras clave',
            details: error instanceof Error ? error.message : 'Error desconocido'
          });
        }
      }
    }
  
    // Actualizar color de categoría global
    public async updateCategoryColor(req: Request, res: Response, next: NextFunction) {
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