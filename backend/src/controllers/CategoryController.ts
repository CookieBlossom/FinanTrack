import { Request, Response } from 'express';
import { CategoryService } from '../services/CategoryService.js';
import { ICategoryCreate, ICategoryUpdate } from '../interfaces/ICategory.js';

export class CategoryController {
    private categoryService: CategoryService;

    constructor() {
        this.categoryService = new CategoryService();
    }

    public getAll = async (_req: Request, res: Response): Promise<void> => {
        try {
            const categories = await this.categoryService.getAllCategories();
            res.json(categories);
        } catch (error) {
            console.error('Error al obtener categorías:', error);
            res.status(500).json({
                message: 'Error al obtener las categorías',
                error: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    };

    public getById = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id);
            const category = await this.categoryService.getCategoryById(id);
            
            if (!category) {
                res.status(404).json({ message: 'Categoría no encontrada' });
                return;
            }
            
            res.json(category);
        } catch (error) {
            console.error('Error al obtener categoría:', error);
            res.status(500).json({
                message: 'Error al obtener la categoría',
                error: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    };

    public search = async (req: Request, res: Response): Promise<void> => {
        try {
            const keyword = req.query.keyword as string;
            if (!keyword) {
                res.status(400).json({ message: 'Se requiere un término de búsqueda' });
                return;
            }

            const categories = await this.categoryService.searchCategories(keyword);
            res.json(categories);
        } catch (error) {
            console.error('Error al buscar categorías:', error);
            res.status(500).json({
                message: 'Error al buscar categorías',
                error: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    };

    public create = async (req: Request, res: Response): Promise<void> => {
        try {
            const categoryData: ICategoryCreate = req.body;
            
            if (!categoryData.nameCategory) {
                res.status(400).json({ message: 'El nombre de la categoría es requerido' });
                return;
            }

            const newCategory = await this.categoryService.createCategory(categoryData);
            res.status(201).json(newCategory);
        } catch (error) {
            console.error('Error al crear categoría:', error);
            res.status(500).json({
                message: 'Error al crear la categoría',
                error: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    };

    public update = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id);
            const categoryData: ICategoryUpdate = req.body;

            if (!Object.keys(categoryData).length) {
                res.status(400).json({ message: 'No se proporcionaron datos para actualizar' });
                return;
            }

            const updatedCategory = await this.categoryService.updateCategory(id, categoryData);
            
            if (!updatedCategory) {
                res.status(404).json({ message: 'Categoría no encontrada' });
                return;
            }

            res.json(updatedCategory);
        } catch (error) {
            console.error('Error al actualizar categoría:', error);
            res.status(500).json({
                message: 'Error al actualizar la categoría',
                error: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    };

    public delete = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id);
            const deleted = await this.categoryService.deleteCategory(id);

            if (!deleted) {
                res.status(404).json({ message: 'Categoría no encontrada' });
                return;
            }

            res.status(200).json({ message: 'Categoría eliminada correctamente' });
        } catch (error) {
            console.error('Error al eliminar categoría:', error);
            res.status(500).json({
                message: 'Error al eliminar la categoría',
                error: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    };
}