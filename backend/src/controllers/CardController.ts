import { Request, Response } from 'express';
import { CardService } from '../services/CardService';
import { DatabaseError } from '../utils/errors';
import { cardSchema, cardUpdateSchema } from '../validators/cardSchema';
import { AuthRequest } from '../interfaces/IAuth';
import { ZodError } from 'zod';

export class CardController {
  private cardService: CardService;

  constructor() {
    this.cardService = new CardService();
  }

  public getAllCards = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Usuario no autenticado' });
        return;
      }

      const cards = await this.cardService.getAllCardsByUserId(userId);
      res.json(cards);
    } catch (error) {
      if (error instanceof DatabaseError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Error interno del servidor' });
      }
    }
  };

  public getCardById = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Usuario no autenticado' });
        return;
      }

      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Formato de ID inválido' });
        return;
      }

      const card = await this.cardService.getCardById(id, userId);
      res.json(card);
    } catch (error) {
      if (error instanceof DatabaseError) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Error interno del servidor' });
      }
    }
  };

  public createCard = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Usuario no autenticado' });
        return;
      }

      const validatedData = cardSchema.parse(req.body);
      const card = await this.cardService.createCard(userId, validatedData);
      res.status(201).json(card);
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

  public updateCard = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Usuario no autenticado' });
        return;
      }

      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Formato de ID inválido' });
        return;
      }

      const validatedData = cardUpdateSchema.parse(req.body);
      const card = await this.cardService.updateCard(id, userId, validatedData);
      res.json(card);
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

  public deleteCard = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Usuario no autenticado' });
        return;
      }

      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Formato de ID inválido' });
        return;
      }

      await this.cardService.deleteCard(id, userId);
      res.status(204).send();
    } catch (error) {
      if (error instanceof DatabaseError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Error interno del servidor' });
      }
    }
  };

  public updateBalance = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Usuario no autenticado' });
        return;
      }

      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Formato de ID inválido' });
        return;
      }

      const { amount } = req.body;
      if (typeof amount !== 'number') {
        res.status(400).json({ error: 'El monto debe ser un número' });
        return;
      }

      const card = await this.cardService.updateBalance(id, userId, amount);
      res.json(card);
    } catch (error) {
      if (error instanceof DatabaseError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Error interno del servidor' });
      }
    }
  };
} 