"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsController = void 0;
const analytics_service_1 = require("../services/analytics.service");
class AnalyticsController {
    constructor() {
        this.getAnalytics = async (req, res, next) => {
            try {
                const userId = req.user?.id;
                if (!userId) {
                    res.status(401).json({ message: 'Usuario no autenticado' });
                    return;
                }
                const data = await this.analyticsService.getAnalyticsData(userId);
                res.json(data);
            }
            catch (error) {
                console.error('Error al obtener datos de analytics:', error);
                res.status(500).json({ message: 'Error al obtener datos de analytics' });
            }
        };
        this.getAnalyticsByMonth = async (req, res, next) => {
            try {
                const userId = req.user?.id;
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
                const data = await this.analyticsService.getAnalyticsDataByMonth(userId, year, month);
                res.json(data);
            }
            catch (error) {
                console.error('Error al obtener datos de analytics por mes:', error);
                res.status(500).json({ message: 'Error al obtener datos de analytics por mes' });
            }
        };
        this.analyticsService = new analytics_service_1.AnalyticsService();
    }
}
exports.AnalyticsController = AnalyticsController;
//# sourceMappingURL=AnalyticsController.js.map