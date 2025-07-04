import { Request, Response, NextFunction } from 'express';
import { PlanService } from '../services/plan.service';
import { AuthRequest } from '../interfaces/AuthRequest';
import { MovementService } from '../services/movement.service';
import { CardService } from '../services/card.service';
import { CategoryService } from '../services/category.service';
import { ScraperService } from '../services/scrapers/scraper.service';
import { ProjectedMovementService } from '../services/projectedMovement.service';
import { RedisService } from '../services/redis.service';

export class PlanController {
  private planService: PlanService;
  private movementService: MovementService;
  private cardService: CardService;
  private categoryService: CategoryService;
  private scraperService: ScraperService;
  private projectedMovementService: ProjectedMovementService;

  constructor() {
    this.planService = new PlanService();
    this.movementService = new MovementService();
    this.cardService = new CardService();
    this.categoryService = new CategoryService();
    const redisService = new RedisService();
    this.scraperService = new ScraperService(redisService);
    this.projectedMovementService = new ProjectedMovementService();
  }

  public getPlan = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as AuthRequest).user;
      if (!user) {
        return res.status(401).json({ message: 'Usuario no autenticado' });
      }
      res.json({ planId: user.planId, planName: user.planName });
    } catch (error) {
      res.status(500).json({ message: 'Error al obtener el plan', error });
    }
  };

  public getLimits = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as AuthRequest).user;
      if (!user) {
        return res.status(401).json({ message: 'Usuario no autenticado' });
      }
      const limits = await this.planService.getLimitsForPlan(user.planId);
      res.json(limits);
    } catch (error) {
      res.status(500).json({ message: 'Error al obtener los límites del plan', error });
    }
  };

  public getPermissions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as AuthRequest).user;
      if (!user) {
        return res.status(401).json({ message: 'Usuario no autenticado' });
      }
      const permissions = await this.planService.getAllPermissionsForPlan(user.planId);
      res.json(permissions);
    } catch (error) {
      res.status(500).json({ message: 'Error al obtener los permisos del plan', error });
    }
  };

  public getUsage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as AuthRequest).user;
      if (!user) {
        return res.status(401).json({ message: 'Usuario no autenticado' });
      }

      const currentMonth = new Date();
      const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);

      // Obtener límites del plan
      const limits = await this.planService.getLimitsForPlan(user.planId);

      // Calcular uso actual
      const [
        manualMovesCount,
        manualCardsCount,
        keywordsCount,
        cartolaMovesCount,
        scraperTasksCount,
        projectedMovesCount
      ] = await Promise.all([
        this.movementService.countMonthlyManualMoves(user.id),
        this.cardService.countAllManualCards(user.id),
        this.getKeywordsCount(user.id),
        this.getCartolaMovesCount(user.id, startOfMonth),
        this.getScraperTasksCount(user.id, startOfMonth),
        this.projectedMovementService.countProjectedByUser(user.id)
      ]);

      const usage = {
        manual_movements: {
          used: manualMovesCount,
          limit: limits.manual_movements,
          remaining: await this.planService.getRemainingLimit(user.planId, 'manual_movements', manualMovesCount)
        },
        max_cards: {
          used: manualCardsCount,
          limit: limits.max_cards,
          remaining: await this.planService.getRemainingLimit(user.planId, 'max_cards', manualCardsCount)
        },
        keywords_per_category: {
          used: keywordsCount,
          limit: limits.keywords_per_category,
          remaining: await this.planService.getRemainingLimit(user.planId, 'keywords_per_category', keywordsCount)
        },
        cartola_movements: {
          used: cartolaMovesCount,
          limit: limits.cartola_movements,
          remaining: await this.planService.getRemainingLimit(user.planId, 'cartola_movements', cartolaMovesCount)
        },
        scraper_movements: {
          used: scraperTasksCount,
          limit: limits.scraper_movements,
          remaining: await this.planService.getRemainingLimit(user.planId, 'scraper_movements', scraperTasksCount)
        },
        projected_movements: {
          used: projectedMovesCount,
          limit: limits.projected_movements,
          remaining: await this.planService.getRemainingLimit(user.planId, 'projected_movements', projectedMovesCount)
        }
      };

      res.json(usage);
    } catch (error) {
      console.error('Error al obtener el uso:', error);
      res.status(500).json({ message: 'Error al obtener el uso del plan', error });
    }
  };

  private async getKeywordsCount(userId: number): Promise<number> {
    try {
      const query = `
        SELECT COUNT(*) as count 
        FROM user_category_keywords 
        WHERE user_id = $1 AND keywords IS NOT NULL AND array_length(keywords, 1) > 0
      `;
      const result = await this.movementService['pool'].query(query, [userId]);
      return parseInt(result.rows[0].count);
    } catch (error) {
      console.error('Error al contar keywords:', error);
      return 0;
    }
  }

  private async getCartolaMovesCount(userId: number, startOfMonth: Date): Promise<number> {
    try {
      const query = `
        SELECT COUNT(*) as count 
        FROM movements 
        WHERE movement_source = 'cartola' 
        AND card_id IN (SELECT id FROM cards WHERE user_id = $1)
        AND transaction_date >= $2
      `;
      const result = await this.movementService['pool'].query(query, [userId, startOfMonth]);
      return parseInt(result.rows[0].count);
    } catch (error) {
      console.error('Error al contar movimientos de cartola:', error);
      return 0;
    }
  }

  private async getScraperTasksCount(userId: number, startOfMonth: Date): Promise<number> {
    try {
      const tasks = await this.scraperService.getAllTasks(userId);
      return tasks.filter(task => new Date(task.createdAt) >= startOfMonth).length;
    } catch (error) {
      console.error('Error al contar tareas del scraper:', error);
      return 0;
    }
  }
} 