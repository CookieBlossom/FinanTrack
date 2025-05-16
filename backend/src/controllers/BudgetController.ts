import { Response } from 'express';
import { BudgetService } from '../services/BudgetService';
import { IBudgetCreate, IBudgetUpdate } from '../interfaces/IBudget';
import { AuthRequest } from '../interfaces/IAuth';

export class BudgetController {
    private budgetService: BudgetService;

    constructor() {
        this.budgetService = new BudgetService();
    }

    public getAllBudgets = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            if (!req.user?.id) {
                res.status(401).json({ message: 'Usuario no autenticado' });
                return;
            }

            const budgets = await this.budgetService.getAllBudgetsByUserId(req.user.id);
            res.json(budgets);
        } catch (error) {
            console.error('Error al obtener presupuestos:', error);
            res.status(500).json({
                message: 'Error al obtener los presupuestos',
                error: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    };

    public getBudgetsByCategory = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            if (!req.user?.id) {
                res.status(401).json({ message: 'Usuario no autenticado' });
                return;
            }
            
            const categoryId = parseInt(req.params.categoryId);
            if (isNaN(categoryId)) {
                res.status(400).json({ message: 'ID de categoría no válido' });
                return;
            }

            const budgets = await this.budgetService.getBudgetsByCategory(req.user.id, categoryId);
            res.json(budgets);
        } catch (error) {
            console.error('Error al obtener presupuestos por categoría:', error);
            res.status(500).json({
                message: 'Error al obtener los presupuestos por categoría',
                error: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    };

    public getBudgetsByStatus = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            if (!req.user?.id) {
                res.status(401).json({ message: 'Usuario no autenticado' });
                return;
            }
            
            const status = req.params.status;
            if (!status || !['active', 'completed', 'cancelled'].includes(status)) {
                res.status(400).json({ message: 'Estado no válido. Debe ser active, completed o cancelled.' });
                return;
            }

            const budgets = await this.budgetService.getBudgetsByStatus(req.user.id, status);
            res.json(budgets);
        } catch (error) {
            console.error('Error al obtener presupuestos por estado:', error);
            res.status(500).json({
                message: 'Error al obtener los presupuestos por estado',
                error: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    };

    public getBudgetById = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            if (!req.user?.id) {
                res.status(401).json({ message: 'Usuario no autenticado' });
                return;
            }
            
            const budgetId = parseInt(req.params.id);
            if (isNaN(budgetId)) {
                res.status(400).json({ message: 'ID de presupuesto no válido' });
                return;
            }

            const budget = await this.budgetService.getBudgetById(budgetId, req.user.id);
            
            if (!budget) {
                res.status(404).json({ message: 'Presupuesto no encontrado' });
                return;
            }
            
            res.json(budget);
        } catch (error) {
            console.error('Error al obtener presupuesto:', error);
            res.status(500).json({
                message: 'Error al obtener el presupuesto',
                error: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    };

    public createBudget = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            if (!req.user?.id) {
                res.status(401).json({ message: 'Usuario no autenticado' });
                return;
            }
            
            const budgetData: IBudgetCreate = req.body;
            
            // Validaciones básicas
            if (!budgetData.amountLimit || budgetData.amountLimit <= 0) {
                res.status(400).json({ message: 'El límite de presupuesto debe ser mayor que cero' });
                return;
            }

            if (!budgetData.period) {
                res.status(400).json({ message: 'El período es requerido' });
                return;
            }

            if (!budgetData.startDate) {
                res.status(400).json({ message: 'La fecha de inicio es requerida' });
                return;
            }

            const newBudget = await this.budgetService.createBudget(req.user.id, budgetData);
            res.status(201).json(newBudget);
        } catch (error) {
            console.error('Error al crear presupuesto:', error);
            res.status(500).json({
                message: 'Error al crear el presupuesto',
                error: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    };

    public updateBudget = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            if (!req.user?.id) {
                res.status(401).json({ message: 'Usuario no autenticado' });
                return;
            }
            
            const budgetId = parseInt(req.params.id);
            if (isNaN(budgetId)) {
                res.status(400).json({ message: 'ID de presupuesto no válido' });
                return;
            }

            const budgetData: IBudgetUpdate = req.body;

            if (!Object.keys(budgetData).length) {
                res.status(400).json({ message: 'No se proporcionaron datos para actualizar' });
                return;
            }

            // Validaciones de datos si se proporcionan
            if (budgetData.amountLimit !== undefined && budgetData.amountLimit <= 0) {
                res.status(400).json({ message: 'El límite de presupuesto debe ser mayor que cero' });
                return;
            }

            if (budgetData.alertThreshold !== undefined && 
                (budgetData.alertThreshold < 0 || budgetData.alertThreshold > 100)) {
                res.status(400).json({ message: 'El umbral de alerta debe estar entre 0 y 100' });
                return;
            }

            const updatedBudget = await this.budgetService.updateBudget(budgetId, req.user.id, budgetData);
            
            if (!updatedBudget) {
                res.status(404).json({ message: 'Presupuesto no encontrado' });
                return;
            }

            res.json(updatedBudget);
        } catch (error) {
            console.error('Error al actualizar presupuesto:', error);
            res.status(500).json({
                message: 'Error al actualizar el presupuesto',
                error: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    };

    public deleteBudget = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            if (!req.user?.id) {
                res.status(401).json({ message: 'Usuario no autenticado' });
                return;
            }
            
            const budgetId = parseInt(req.params.id);
            if (isNaN(budgetId)) {
                res.status(400).json({ message: 'ID de presupuesto no válido' });
                return;
            }

            const deleted = await this.budgetService.deleteBudget(budgetId, req.user.id);

            if (!deleted) {
                res.status(404).json({ message: 'Presupuesto no encontrado' });
                return;
            }

            res.status(200).json({ message: 'Presupuesto eliminado correctamente' });
        } catch (error) {
            console.error('Error al eliminar presupuesto:', error);
            res.status(500).json({
                message: 'Error al eliminar el presupuesto',
                error: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    };

    public getAllBudgetsWithSpending = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            if (!req.user?.id) {
                res.status(401).json({ message: 'Usuario no autenticado' });
                return;
            }

            const budgetsWithSpending = await this.budgetService.getAllBudgetsWithSpending(req.user.id);
            res.json(budgetsWithSpending);
        } catch (error) {
            console.error('Error al obtener presupuestos con gastos:', error);
            res.status(500).json({
                message: 'Error al obtener los presupuestos con sus gastos asociados',
                error: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    };
} 