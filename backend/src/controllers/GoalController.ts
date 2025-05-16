import { Request, Response } from 'express';
import { GoalService } from '../services/GoalService';
import { IGoalCreate, IGoalUpdate } from '../interfaces/IGoal';
import { AuthRequest } from '../interfaces/IAuth';

export class GoalController {
    private goalService: GoalService;

    constructor() {
        this.goalService = new GoalService();
    }

    public getAllGoals = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            if (!req.user?.id) {
                res.status(401).json({ message: 'Usuario no autenticado' });
                return;
            }

            const goals = await this.goalService.getAllGoalsByUserId(req.user.id);
            res.json(goals);
        } catch (error) {
            console.error('Error al obtener objetivos:', error);
            res.status(500).json({
                message: 'Error al obtener los objetivos',
                error: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    };

    public getGoalsByCategory = async (req: AuthRequest, res: Response): Promise<void> => {
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

            const goals = await this.goalService.getGoalsByCategory(req.user.id, categoryId);
            res.json(goals);
        } catch (error) {
            console.error('Error al obtener objetivos por categoría:', error);
            res.status(500).json({
                message: 'Error al obtener los objetivos por categoría',
                error: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    };

    public getGoalById = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            if (!req.user?.id) {
                res.status(401).json({ message: 'Usuario no autenticado' });
                return;
            }
            
            const goalId = parseInt(req.params.id);
            if (isNaN(goalId)) {
                res.status(400).json({ message: 'ID de objetivo no válido' });
                return;
            }

            const goal = await this.goalService.getGoalById(goalId, req.user.id);
            
            if (!goal) {
                res.status(404).json({ message: 'Objetivo no encontrado' });
                return;
            }
            
            res.json(goal);
        } catch (error) {
            console.error('Error al obtener objetivo:', error);
            res.status(500).json({
                message: 'Error al obtener el objetivo',
                error: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    };

    public createGoal = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            if (!req.user?.id) {
                res.status(401).json({ message: 'Usuario no autenticado' });
                return;
            }
            
            const goalData: IGoalCreate = req.body;
            
            // Validaciones básicas
            if (!goalData.amountExpected || goalData.amountExpected <= 0) {
                res.status(400).json({ message: 'El monto esperado debe ser mayor que cero' });
                return;
            }

            if (!goalData.categoryId) {
                res.status(400).json({ message: 'La categoría es requerida' });
                return;
            }

            if (!goalData.deadline) {
                res.status(400).json({ message: 'La fecha límite es requerida' });
                return;
            }

            if (!goalData.goalPeriod) {
                res.status(400).json({ message: 'El período del objetivo es requerido' });
                return;
            }

            const newGoal = await this.goalService.createGoal(req.user.id, goalData);
            res.status(201).json(newGoal);
        } catch (error) {
            console.error('Error al crear objetivo:', error);
            res.status(500).json({
                message: 'Error al crear el objetivo',
                error: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    };

    public updateGoal = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            if (!req.user?.id) {
                res.status(401).json({ message: 'Usuario no autenticado' });
                return;
            }
            
            const goalId = parseInt(req.params.id);
            if (isNaN(goalId)) {
                res.status(400).json({ message: 'ID de objetivo no válido' });
                return;
            }

            const goalData: IGoalUpdate = req.body;

            if (!Object.keys(goalData).length) {
                res.status(400).json({ message: 'No se proporcionaron datos para actualizar' });
                return;
            }

            // Validaciones de datos si se proporcionan
            if (goalData.amountExpected !== undefined && goalData.amountExpected <= 0) {
                res.status(400).json({ message: 'El monto esperado debe ser mayor que cero' });
                return;
            }

            if (goalData.amountActual !== undefined && goalData.amountActual < 0) {
                res.status(400).json({ message: 'El monto actual no puede ser negativo' });
                return;
            }

            const updatedGoal = await this.goalService.updateGoal(goalId, req.user.id, goalData);
            
            if (!updatedGoal) {
                res.status(404).json({ message: 'Objetivo no encontrado' });
                return;
            }

            res.json(updatedGoal);
        } catch (error) {
            console.error('Error al actualizar objetivo:', error);
            res.status(500).json({
                message: 'Error al actualizar el objetivo',
                error: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    };

    public updateGoalProgress = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            if (!req.user?.id) {
                res.status(401).json({ message: 'Usuario no autenticado' });
                return;
            }
            
            const goalId = parseInt(req.params.id);
            if (isNaN(goalId)) {
                res.status(400).json({ message: 'ID de objetivo no válido' });
                return;
            }

            const { amountActual } = req.body;

            if (amountActual === undefined || amountActual < 0) {
                res.status(400).json({ message: 'El monto actual debe ser un valor no negativo' });
                return;
            }

            const updatedGoal = await this.goalService.updateGoalProgress(goalId, req.user.id, amountActual);
            
            if (!updatedGoal) {
                res.status(404).json({ message: 'Objetivo no encontrado' });
                return;
            }

            res.json(updatedGoal);
        } catch (error) {
            console.error('Error al actualizar progreso del objetivo:', error);
            res.status(500).json({
                message: 'Error al actualizar el progreso del objetivo',
                error: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    };

    public deleteGoal = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            if (!req.user?.id) {
                res.status(401).json({ message: 'Usuario no autenticado' });
                return;
            }
            
            const goalId = parseInt(req.params.id);
            if (isNaN(goalId)) {
                res.status(400).json({ message: 'ID de objetivo no válido' });
                return;
            }

            const deleted = await this.goalService.deleteGoal(goalId, req.user.id);

            if (!deleted) {
                res.status(404).json({ message: 'Objetivo no encontrado' });
                return;
            }

            res.status(200).json({ message: 'Objetivo eliminado correctamente' });
        } catch (error) {
            console.error('Error al eliminar objetivo:', error);
            res.status(500).json({
                message: 'Error al eliminar el objetivo',
                error: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    };
} 