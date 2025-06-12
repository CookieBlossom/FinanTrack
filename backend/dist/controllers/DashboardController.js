"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardController = void 0;
const movement_service_1 = require("../services/movement.service");
const scraper_service_1 = require("../services/scrapers/scraper.service");
const ScraperDataProcessor_1 = require("../utils/ScraperDataProcessor");
const category_service_1 = require("../services/category.service");
const redis_service_1 = require("../services/redis.service");
const card_service_1 = require("../services/card.service");
class DashboardController {
    constructor() {
        this.getCategoryExpenses = async (req, res) => {
            try {
                const userId = req.user?.id;
                if (!userId) {
                    return res.status(401).json({ error: 'Usuario no autenticado' });
                }
                const now = new Date();
                const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
                const filters = { startDate, endDate, movementType: 'expense' };
                const allMovements = await this.movementService.getMovements(filters);
                const cardService = new card_service_1.CardService();
                const userMovementPromises = allMovements.map(async (mov) => {
                    const card = await cardService.getCardById(mov.cardId, userId);
                    return card ? mov : null;
                });
                const movements = (await Promise.all(userMovementPromises)).filter(m => m !== null);
                const categoryData = movements.reduce((acc, mov) => {
                    const categoryName = mov.category?.nameCategory || 'Sin Categoría';
                    acc[categoryName] = (acc[categoryName] || 0) + Math.abs(mov.amount);
                    return acc;
                }, {});
                const result = Object.entries(categoryData).map(([categoryName, value]) => ({ name: categoryName, value }));
                return res.json(result);
            }
            catch (error) {
                console.error('Error en getCategoryExpenses:', error);
                return res.status(500).json({ message: 'Error al obtener los datos de gastos por categoría' });
            }
        };
        /**
         * Obtiene los movimientos recientes, incluyendo los del scraper
         */
        this.getRecentMovements = async (req, res) => {
            try {
                const userId = req.user?.id;
                if (!userId) {
                    return res.status(401).json({ error: 'Usuario no autenticado' });
                }
                const limit = parseInt(req.query.limit) || 10;
                const allMovements = await this.movementService.getMovements({});
                const cardService = new card_service_1.CardService();
                const userMovementPromises = allMovements.map(async (mov) => {
                    const card = await cardService.getCardById(mov.cardId, userId);
                    return card ? mov : null;
                });
                let movements = (await Promise.all(userMovementPromises)).filter(m => m !== null);
                movements.sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime());
                movements = movements.slice(0, limit);
                return res.json(movements);
            }
            catch (error) {
                console.error('Error en getRecentMovements:', error);
                return res.status(500).json({ message: 'Error al obtener los movimientos recientes' });
            }
        };
        const cardService = new card_service_1.CardService();
        this.movementService = new movement_service_1.MovementService();
        const redisService = new redis_service_1.RedisService();
        this.scraperService = new scraper_service_1.ScraperService(redisService);
        this.categoryService = new category_service_1.CategoryService();
    }
    /**
     * Obtiene los ingresos vs gastos del año especificado
     */
    async getIncomeVsExpenses(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ error: 'Usuario no autenticado' });
            }
            const year = parseInt(req.query.year) || new Date().getFullYear();
            if (year < 2000 || year > 2100) {
                return res.status(400).json({ error: 'Año fuera de rango válido' });
            }
            const startDate = new Date(year, 0, 1);
            const endDate = new Date(year, 11, 31, 23, 59, 59);
            const filters = { startDate, endDate };
            const movements = await this.movementService.getMovements(filters);
            const userMovements = movements.filter(async (mov) => {
                const card = await new card_service_1.CardService().getCardById(mov.cardId, userId);
                return !!card;
            });
            const resolvedUserMovements = await Promise.all(userMovements.map(async (movPromise) => movPromise ? await this.movementService.getMovementById((await movPromise).id) : null));
            const finalMovements = resolvedUserMovements.filter(m => m !== null);
            const monthlyData = new Map();
            const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
            months.forEach(month => monthlyData.set(month, { ingresos: 0, gastos: 0 }));
            finalMovements.forEach((movement) => {
                const date = new Date(movement.transactionDate);
                const month = months[date.getMonth()];
                if (monthlyData.has(month)) {
                    if (movement.movementType === 'income') {
                        monthlyData.get(month).ingresos += movement.amount;
                    }
                    else if (movement.movementType === 'expense') {
                        monthlyData.get(month).gastos += Math.abs(movement.amount);
                    }
                }
            });
            const formattedData = [
                {
                    name: 'Ingresos',
                    series: months.map(month => ({
                        name: month,
                        value: monthlyData.get(month)?.ingresos || 0
                    }))
                },
                {
                    name: 'Gastos',
                    series: months.map(month => ({
                        name: month,
                        value: monthlyData.get(month)?.gastos || 0
                    }))
                }
            ];
            return res.json(formattedData);
        }
        catch (error) {
            console.error('Error en getIncomeVsExpenses:', error);
            return res.status(500).json({ error: 'Error al obtener datos de ingresos vs gastos' });
        }
    }
    ;
    async convertScraperMovement(mov, taskId, defaultCardId) {
        const processedMov = await ScraperDataProcessor_1.ScraperDataProcessor.processMovement(mov, defaultCardId);
        return {
            ...processedMov,
            metadata: {
                ...processedMov.metadata,
                scraperTaskId: taskId
            }
        };
    }
    async processScraperMovements(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ error: 'Usuario no autenticado' });
            }
            const { rawMovements, defaultCardId, scraperTaskId } = req.body;
            if (!Array.isArray(rawMovements) || typeof defaultCardId !== 'number' || typeof scraperTaskId !== 'string') {
                return res.status(400).json({ message: 'Datos inválidos' });
            }
            const createdMovements = [];
            const errors = [];
            for (const rawMov of rawMovements) {
                try {
                    const movementToCreate = await this.convertScraperMovement(rawMov, scraperTaskId, defaultCardId);
                    const newMovement = await this.movementService.createMovement(movementToCreate, userId);
                    createdMovements.push(newMovement);
                }
                catch (error) {
                    errors.push({ rawMovement: rawMov, error: error instanceof Error ? error.message : 'Error desconocido' });
                }
            }
            if (errors.length > 0 && createdMovements.length > 0) {
                return res.status(207).json({ message: 'Procesamiento completado con algunos errores.', createdMovements, errors });
            }
            else if (errors.length > 0) {
                return res.status(400).json({ message: 'Error al procesar todos los movimientos.', errors });
            }
            else {
                return res.status(201).json({ message: 'Movimientos procesados exitosamente.', movements: createdMovements });
            }
        }
        catch (error) {
            console.error('Error general en processScraperMovements:', error);
            return res.status(500).json({ message: 'Error al procesar los movimientos del scraper' });
        }
    }
}
exports.DashboardController = DashboardController;
//# sourceMappingURL=DashboardController.js.map