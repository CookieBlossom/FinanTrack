import { Request, Response } from 'express';
import { MovementService } from '../services/movementService';
import { IMovementCreate, IMovementUpdate, IMovementFilters } from '../interfaces/IMovement';

export class MovementController {
    private movementService: MovementService;

    constructor() {
        this.movementService = new MovementService();
    }

    getAll = async (_req: Request, res: Response): Promise<void> => {
        try {
            const movements = await this.movementService.getAllMovements();
            res.json(movements);
        } catch (error) {
            console.error('Error al obtener movimientos:', error);
            res.status(500).json({
                message: 'Error al obtener los movimientos',
                error: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    };

    getById = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id);
            const movement = await this.movementService.getMovementById(id);
            
            if (!movement) {
                res.status(404).json({ message: 'Movimiento no encontrado' });
                return;
            }
            
            res.json(movement);
        } catch (error) {
            console.error('Error al obtener movimiento:', error);
            res.status(500).json({
                message: 'Error al obtener el movimiento',
                error: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    };

    getByFilters = async (req: Request, res: Response): Promise<void> => {
        try {
            const filters: IMovementFilters = {
                cardId: req.query.cardId ? parseInt(req.query.cardId as string) : undefined,
                categoryId: req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined,
                movementType: req.query.movementType as 'income' | 'expense' | undefined,
                movementSource: req.query.movementSource as 'manual' | 'scrapper' | 'subscription' | 'projected' | undefined,
                startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
                endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
                minAmount: req.query.minAmount ? parseFloat(req.query.minAmount as string) : undefined,
                maxAmount: req.query.maxAmount ? parseFloat(req.query.maxAmount as string) : undefined
            };

            const movements = await this.movementService.getMovementsByFilters(filters);
            res.json(movements);
        } catch (error) {
            console.error('Error al filtrar movimientos:', error);
            res.status(500).json({
                message: 'Error al filtrar los movimientos',
                error: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    };

    create = async (req: Request, res: Response): Promise<void> => {
        try {
            const movementData: IMovementCreate = {
                ...req.body,
                transactionDate: new Date(req.body.transactionDate)
            };
            
            if (!this.validateMovementData(movementData)) {
                res.status(400).json({ message: 'Datos del movimiento incompletos o inválidos' });
                return;
            }

            const newMovement = await this.movementService.createMovement(movementData);
            res.status(201).json(newMovement);
        } catch (error) {
            console.error('Error al crear movimiento:', error);
            res.status(500).json({
                message: 'Error al crear el movimiento',
                error: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    };

    update = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id);
            const movementData: IMovementUpdate = {
                ...req.body,
                transactionDate: req.body.transactionDate ? new Date(req.body.transactionDate) : undefined
            };

            if (!Object.keys(movementData).length) {
                res.status(400).json({ message: 'No se proporcionaron datos para actualizar' });
                return;
            }

            const updatedMovement = await this.movementService.updateMovement(id, movementData);
            
            if (!updatedMovement) {
                res.status(404).json({ message: 'Movimiento no encontrado' });
                return;
            }

            res.json(updatedMovement);
        } catch (error) {
            console.error('Error al actualizar movimiento:', error);
            res.status(500).json({
                message: 'Error al actualizar el movimiento',
                error: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    };

    delete = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id);
            const deleted = await this.movementService.deleteMovement(id);

            if (!deleted) {
                res.status(404).json({ message: 'Movimiento no encontrado' });
                return;
            }

            res.status(200).json({ message: 'Movimiento eliminado correctamente' });
        } catch (error) {
            console.error('Error al eliminar movimiento:', error);
            res.status(500).json({
                message: 'Error al eliminar el movimiento',
                error: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    };

    private validateMovementData(data: IMovementCreate): boolean {
        return !!(
            data.cardId &&
            data.amount &&
            data.movementType &&
            data.movementSource &&
            data.transactionDate
        );
    }
} 