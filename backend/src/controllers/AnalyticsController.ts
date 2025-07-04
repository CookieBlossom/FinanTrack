import { Request, Response, NextFunction } from 'express';
import { AnalyticsService } from '../services/analytics.service';
import { AuthRequest } from '../interfaces/AuthRequest';
import { IAnalyticsData } from '../interfaces/IAnalytics';

export class AnalyticsController {
    private analyticsService: AnalyticsService;

    constructor() {
        this.analyticsService = new AnalyticsService();
    }

    public getAnalytics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = (req as AuthRequest).user?.id;
            if (!userId) {
                res.status(401).json({ message: 'Usuario no autenticado' });
                return;
            }

            const data: IAnalyticsData = await this.analyticsService.getAnalyticsData(userId);
            res.json(data);
        } catch (error) {
            console.error('Error al obtener datos de analytics:', error);
            res.status(500).json({ message: 'Error al obtener datos de analytics' });
        }
    };

    public getAnalyticsByMonth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = (req as AuthRequest).user?.id;
            if (!userId) {
                res.status(401).json({ message: 'Usuario no autenticado' });
                return;
            }

            const year = parseInt(req.params.year);
            const month = parseInt(req.params.month);

            if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
                res.status(400).json({ message: 'Año o mes inválido' });
                return;
            }

            const data: IAnalyticsData = await this.analyticsService.getAnalyticsDataByMonth(userId, year, month);
            res.json(data);
        } catch (error) {
            console.error('Error al obtener datos de analytics por mes:', error);
            res.status(500).json({ message: 'Error al obtener datos de analytics por mes' });
        }
    };
} 