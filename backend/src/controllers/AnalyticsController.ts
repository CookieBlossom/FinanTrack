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
} 