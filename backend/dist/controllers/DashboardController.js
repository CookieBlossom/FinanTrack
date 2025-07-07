"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardController = void 0;
const movement_service_1 = require("../services/movement.service");
const ScraperDataProcessor_1 = require("../utils/ScraperDataProcessor");
const category_service_1 = require("../services/category.service");
const card_service_1 = require("../services/card.service");
const redis_service_1 = require("../services/redis.service");
class DashboardController {
    constructor() {
        this.getIncomeVsExpenses = async (req, res, next) => {
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
                const filters = { startDate, endDate, userId };
                const movements = await this.movementService.getMovements(filters);
                const monthlyData = new Map();
                const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
                months.forEach(month => monthlyData.set(month, { ingresos: 0, gastos: 0 }));
                movements.forEach((movement) => {
                    const amount = Number(movement.amount);
                    if (isNaN(amount) || amount === null || amount === undefined) {
                        console.warn(`Movimiento con amount inválido: ${movement.id}, amount: ${movement.amount}`);
                        return;
                    }
                    const date = new Date(movement.transactionDate);
                    const month = months[date.getMonth()];
                    if (monthlyData.has(month)) {
                        if (movement.movementType === 'income') {
                            monthlyData.get(month).ingresos += amount;
                        }
                        else if (movement.movementType === 'expense') {
                            monthlyData.get(month).gastos += Math.abs(amount);
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
                console.log('Datos formateados para ingresos vs gastos:', formattedData);
                return res.json(formattedData);
            }
            catch (error) {
                console.error('Error en getIncomeVsExpenses:', error);
                return res.status(500).json({ error: 'Error al obtener datos de ingresos vs gastos' });
            }
        };
        this.getCategoryExpenses = async (req, res, next) => {
            try {
                const userId = req.user?.id;
                if (!userId) {
                    return res.status(401).json({ error: 'Usuario no autenticado' });
                }
                const now = new Date();
                const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
                const filters = {
                    startDate,
                    endDate,
                    movementType: 'expense',
                    userId
                };
                console.log('[DashboardController] Buscando gastos por categoría con filtros:', filters);
                const movements = await this.movementService.getMovements(filters);
                console.log(`[DashboardController] Encontrados ${movements.length} movimientos`);
                const categoryData = movements.reduce((acc, mov) => {
                    const amount = Number(mov.amount);
                    if (isNaN(amount) || amount === null || amount === undefined) {
                        console.warn(`Movimiento con amount inválido: ${mov.id}, amount: ${mov.amount}`);
                        return acc;
                    }
                    const categoryName = mov.category?.nameCategory || 'Sin categoría';
                    acc[categoryName] = (acc[categoryName] || 0) + Math.abs(amount);
                    return acc;
                }, {});
                const result = Object.entries(categoryData)
                    .map(([categoryName, value]) => ({
                    name: categoryName,
                    value: Math.abs(Number(value)) || 0,
                    movementCount: movements.filter(m => (m.category?.nameCategory || 'Sin categoría') === categoryName).length
                }))
                    .filter(category => category.value > 0)
                    .sort((a, b) => b.value - a.value);
                console.log('Datos formateados para gastos por categoría:', result);
                return res.json(result);
            }
            catch (error) {
                console.error('Error en getCategoryExpenses:', error);
                return res.status(500).json({ message: 'Error al obtener los datos de gastos por categoría' });
            }
        };
        this.getRecentMovements = async (req, res, next) => {
            try {
                const userId = req.user?.id;
                if (!userId) {
                    return res.status(401).json({ error: 'Usuario no autenticado' });
                }
                const limit = parseInt(req.query.limit) || 10;
                const filters = { userId };
                const movements = await this.movementService.getMovements(filters);
                movements.sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime());
                const recentMovements = movements.slice(0, limit);
                return res.json(recentMovements);
            }
            catch (error) {
                console.error('Error en getRecentMovements:', error);
                return res.status(500).json({ message: 'Error al obtener los movimientos recientes' });
            }
        };
        this.getTopExpenses = async (req, res) => {
            try {
                const userId = req.user?.id;
                if (!userId) {
                    res.status(401).json({ message: 'Usuario no autenticado' });
                    return;
                }
                const topExpenses = await this.movementService.getTopExpenses(userId);
                res.json(topExpenses);
            }
            catch (error) {
                console.error('Error al obtener top expenses:', error);
                res.status(500).json({ message: 'Error al obtener top expenses' });
            }
        };
        this.getProjectedMovements = async (req, res) => {
            try {
                const userId = req.user?.id;
                if (!userId) {
                    res.status(401).json({ message: 'Usuario no autenticado' });
                    return;
                }
                const projectedMovements = await this.movementService.getProjectedMovements(userId);
                res.json(projectedMovements);
            }
            catch (error) {
                console.error('Error al obtener movimientos proyectados:', error);
                res.status(500).json({ message: 'Error al obtener movimientos proyectados' });
            }
        };
        this.getFinancialSummary = async (req, res) => {
            try {
                const userId = req.user?.id;
                if (!userId) {
                    res.status(401).json({ message: 'Usuario no autenticado' });
                    return;
                }
                const cards = await this.cardService.getCardsByUserId(userId);
                const totalBalance = cards.reduce((sum, card) => sum + (Number(card.balance) || 0), 0);
                res.json({
                    totalBalance,
                    totalCards: cards.length,
                    activeCards: cards.filter(card => card.statusAccount === 'active').length
                });
            }
            catch (error) {
                console.error('Error al obtener resumen financiero:', error);
                res.status(500).json({ message: 'Error al obtener resumen financiero' });
            }
        };
        this.getExpensesByCategory = async (req, res) => {
            try {
                const userId = req.user?.id;
                if (!userId) {
                    res.status(401).json({ message: 'Usuario no autenticado' });
                    return;
                }
                const expensesByCategory = await this.movementService.getExpensesByCategory(userId);
                res.json(expensesByCategory);
            }
            catch (error) {
                console.error('Error al obtener gastos por categoría:', error);
                res.status(500).json({ message: 'Error al obtener gastos por categoría' });
            }
        };
        const redisService = new redis_service_1.RedisService();
        this.movementService = new movement_service_1.MovementService();
        this.categoryService = new category_service_1.CategoryService();
        this.cardService = new card_service_1.CardService();
    }
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
    async processScraperMovements(req, res, next) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ error: 'Usuario no autenticado' });
            }
            const { rawMovements, defaultCardId, scraperTaskId } = req.body;
            if (!Array.isArray(rawMovements) || typeof defaultCardId !== 'number' || typeof scraperTaskId !== 'string') {
                return res.status(400).json({ message: 'Datos inválidos' });
            }
            console.log(`[DashboardController] Procesando ${rawMovements.length} movimientos del scraper`);
            const createdMovements = [];
            const errors = [];
            for (const rawMov of rawMovements) {
                try {
                    const movementToCreate = await this.convertScraperMovement(rawMov, scraperTaskId, defaultCardId);
                    const newMovement = await this.movementService.createMovement(movementToCreate, userId, req.user.planId);
                    createdMovements.push(newMovement);
                    console.log(`[DashboardController] Movimiento creado: ${newMovement.description} - ${newMovement.amount}`);
                }
                catch (error) {
                    console.error(`[DashboardController] Error procesando movimiento:`, error);
                    errors.push({ rawMovement: rawMov, error: error instanceof Error ? error.message : 'Error desconocido' });
                }
            }
            // Estadísticas del procesamiento
            const stats = {
                total_procesados: rawMovements.length,
                exitosos: createdMovements.length,
                errores: errors.length,
                por_categoria: this.getMovementsByCategory(createdMovements)
            };
            console.log(`[DashboardController] Estadísticas del procesamiento:`, stats);
            if (errors.length > 0 && createdMovements.length > 0) {
                return res.status(207).json({
                    message: 'Procesamiento completado con algunos errores.',
                    createdMovements,
                    errors,
                    stats
                });
            }
            else if (errors.length > 0) {
                return res.status(400).json({
                    message: 'Error al procesar todos los movimientos.',
                    errors,
                    stats
                });
            }
            else {
                return res.status(201).json({
                    message: 'Movimientos procesados exitosamente.',
                    movements: createdMovements,
                    stats
                });
            }
        }
        catch (error) {
            console.error('Error general en processScraperMovements:', error);
            return res.status(500).json({ message: 'Error al procesar los movimientos del scraper' });
        }
    }
    getMovementsByCategory(movements) {
        return movements.reduce((acc, mov) => {
            const categoryName = mov.category?.nameCategory || 'Otros';
            acc[categoryName] = (acc[categoryName] || 0) + 1;
            return acc;
        }, {});
    }
}
exports.DashboardController = DashboardController;
//# sourceMappingURL=DashboardController.js.map