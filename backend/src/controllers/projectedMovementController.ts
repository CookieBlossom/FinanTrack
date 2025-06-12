import { Response } from 'express';
import { ProjectedMovementService } from '../services/projectedMovement.service';
import { IProjectedMovementCreate, IProjectedMovementUpdate, IProjectedMovementFilters } from '../interfaces/IProjectedMovement';
import { IAuthRequest } from '../interfaces/IRequest';

export class ProjectedMovementController {
    private projectedMovementService: ProjectedMovementService;

    constructor() {
        this.projectedMovementService = new ProjectedMovementService();
    }

    getAll = async (req: IAuthRequest, res: Response): Promise<void> => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ message: 'Usuario no autenticado' });
                return;
            }

            const movements = await this.projectedMovementService.getAllProjectedMovements(userId);
            res.json(movements);
        } catch (error) {
            console.error('Error al obtener movimientos proyectados:', error);
            res.status(500).json({
                message: 'Error al obtener los movimientos proyectados',
                error: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    };

    getById = async (req: IAuthRequest, res: Response): Promise<void> => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ message: 'Usuario no autenticado' });
                return;
            }

            const id = parseInt(req.params.id);
            const movement = await this.projectedMovementService.getProjectedMovementById(id, userId);
            
            if (!movement) {
                res.status(404).json({ message: 'Movimiento proyectado no encontrado' });
                return;
            }
            
            res.json(movement);
        } catch (error) {
            console.error('Error al obtener movimiento proyectado:', error);
            res.status(500).json({
                message: 'Error al obtener el movimiento proyectado',
                error: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    };

    getByFilters = async (req: IAuthRequest, res: Response): Promise<void> => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ message: 'Usuario no autenticado' });
                return;
            }

            const filters: IProjectedMovementFilters = {
                userId,
                categoryId: req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined,
                cardId: req.query.cardId ? parseInt(req.query.cardId as string) : undefined,
                movementType: req.query.movementType as 'income' | 'expense' | undefined,
                startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
                endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
                minAmount: req.query.minAmount ? parseFloat(req.query.minAmount as string) : undefined,
                maxAmount: req.query.maxAmount ? parseFloat(req.query.maxAmount as string) : undefined,
                minProbability: req.query.minProbability ? parseInt(req.query.minProbability as string) : undefined,
                maxProbability: req.query.maxProbability ? parseInt(req.query.maxProbability as string) : undefined,
                status: req.query.status as 'pending' | 'completed' | 'cancelled' | undefined,
                recurrenceType: req.query.recurrenceType as 'monthly' | 'yearly' | 'weekly' | null | undefined
            };

            const movements = await this.projectedMovementService.getProjectedMovementsByFilters(filters);
            res.json(movements);
        } catch (error) {
            console.error('Error al filtrar movimientos proyectados:', error);
            res.status(500).json({
                message: 'Error al filtrar los movimientos proyectados',
                error: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    };

    create = async (req: IAuthRequest, res: Response): Promise<void> => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ message: 'Usuario no autenticado' });
                return;
            }

            const movementData: IProjectedMovementCreate = {
                ...req.body,
                userId,
                expectedDate: new Date(req.body.expectedDate)
            };
            
            if (!this.validateProjectedMovementData(movementData)) {
                res.status(400).json({ message: 'Datos del movimiento proyectado incompletos o inválidos' });
                return;
            }

            const newMovement = await this.projectedMovementService.createProjectedMovement(movementData);
            res.status(201).json(newMovement);
        } catch (error) {
            console.error('Error al crear movimiento proyectado:', error);
            res.status(500).json({
                message: 'Error al crear el movimiento proyectado',
                error: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    };

    update = async (req: IAuthRequest, res: Response): Promise<void> => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ message: 'Usuario no autenticado' });
                return;
            }

            const id = parseInt(req.params.id);
            const movementData: IProjectedMovementUpdate = {
                ...req.body,
                expectedDate: req.body.expectedDate ? new Date(req.body.expectedDate) : undefined
            };

            if (!Object.keys(movementData).length) {
                res.status(400).json({ message: 'No se proporcionaron datos para actualizar' });
                return;
            }

            const updatedMovement = await this.projectedMovementService.updateProjectedMovement(
                id,
                userId,
                movementData
            );
            
            if (!updatedMovement) {
                res.status(404).json({ message: 'Movimiento proyectado no encontrado' });
                return;
            }

            res.json(updatedMovement);
        } catch (error) {
            console.error('Error al actualizar movimiento proyectado:', error);
            res.status(500).json({
                message: 'Error al actualizar el movimiento proyectado',
                error: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    };

    delete = async (req: IAuthRequest, res: Response): Promise<void> => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ message: 'Usuario no autenticado' });
                return;
            }

            const id = parseInt(req.params.id);
            const deleted = await this.projectedMovementService.deleteProjectedMovement(id, userId);

            if (!deleted) {
                res.status(404).json({ message: 'Movimiento proyectado no encontrado' });
                return;
            }

            res.status(200).json({ message: 'Movimiento proyectado eliminado correctamente' });
        } catch (error) {
            console.error('Error al eliminar movimiento proyectado:', error);
            res.status(500).json({
                message: 'Error al eliminar el movimiento proyectado',
                error: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    };

    private validateProjectedMovementData(data: IProjectedMovementCreate): boolean {
        return !!(
            data.userId &&
            data.amount &&
            data.movementType &&
            data.expectedDate
        );
    }
} 