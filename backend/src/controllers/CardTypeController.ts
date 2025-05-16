import { Request, Response } from 'express';
import { CardTypeService } from '../services/CardTypeService';
import { DatabaseError } from '../utils/errors';
import { cardTypeSchema, cardTypeUpdateSchema } from '../validators/cardTypeSchema';
import { ZodError } from 'zod';

export class CardTypeController {
  private cardTypeService: CardTypeService;

  constructor() {
    this.cardTypeService = new CardTypeService();
  }

  public getAllCardTypes = async (_req: Request, res: Response): Promise<void> => {
    try {
      const cardTypes = await this.cardTypeService.getAllCardTypes();
      res.json(cardTypes);
    } catch (error) {
      if (error instanceof DatabaseError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Error interno del servidor' });
      }
    }
  };

  public getCardTypeById = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Formato de ID inválido' });
        return;
      }

      const cardType = await this.cardTypeService.getCardTypeById(id);
      res.json(cardType);
    } catch (error) {
      if (error instanceof DatabaseError) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Error interno del servidor' });
      }
    }
  };

  public createCardType = async (req: Request, res: Response): Promise<void> => {
    try {
      const validatedData = cardTypeSchema.parse(req.body);
      const cardType = await this.cardTypeService.createCardType(validatedData);
      res.status(201).json(cardType);
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({ 
          error: 'Error de validación',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        });
      } else if (error instanceof DatabaseError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Error interno del servidor' });
      }
    }
  };

  public updateCardType = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Formato de ID inválido' });
        return;
      }

      const validatedData = cardTypeUpdateSchema.parse(req.body);
      const cardType = await this.cardTypeService.updateCardType(id, validatedData);
      res.json(cardType);
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({ 
          error: 'Error de validación',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        });
      } else if (error instanceof DatabaseError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Error interno del servidor' });
      }
    }
  };

  public deleteCardType = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Formato de ID inválido' });
        return;
      }

      await this.cardTypeService.deleteCardType(id);
      res.status(204).send();
    } catch (error) {
      if (error instanceof DatabaseError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Error interno del servidor' });
      }
    }
  };
} 