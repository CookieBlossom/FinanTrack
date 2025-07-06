import { Request, Response, NextFunction } from 'express';
import { MovementService } from '../services/movement.service';
import { ScraperService } from '../services/scrapers/scraper.service';
import { AuthRequest } from '../interfaces/AuthRequest';
import { IMovement, IMovementCreate, IMovementFilters } from '../interfaces/IMovement';
import { IScraperMovement } from '../interfaces/IScraper';
import { ScraperDataProcessor } from '../utils/ScraperDataProcessor';
import { CategoryService } from '../services/category.service';
import { RedisService } from '../services/redis.service';
import { CardService } from '../services/card.service';
import { UserService } from '../services/user.service';

export class DashboardController {
    private movementService: MovementService;
    private scraperService: ScraperService;
    private categoryService: CategoryService;

    constructor() {
        const cardService = new CardService();
        this.movementService = new MovementService();
        const redisService = new RedisService();
        this.scraperService = new ScraperService(redisService);
        this.categoryService = new CategoryService();
    }

    /**
     * Obtiene los ingresos vs gastos del año especificado
     */
    public getIncomeVsExpenses = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
        try {
            const userId = (req as AuthRequest).user?.id;
            if (!userId) {
                return res.status(401).json({ error: 'Usuario no autenticado' });
            }
            const year = parseInt(req.query.year as string) || new Date().getFullYear();
            if (year < 2000 || year > 2100) {
                return res.status(400).json({ error: 'Año fuera de rango válido' });
            }
            const startDate = new Date(year, 0, 1);
            const endDate = new Date(year, 11, 31, 23, 59, 59);

            const filters: IMovementFilters = { startDate, endDate, userId };
            const movements: IMovement[] = await this.movementService.getMovements(filters);

            const monthlyData = new Map<string, { ingresos: number; gastos: number }>();
            const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
            months.forEach(month => monthlyData.set(month, { ingresos: 0, gastos: 0 }));

            movements.forEach((movement: IMovement) => {
                const amount = Number(movement.amount);
                if (isNaN(amount) || amount === null || amount === undefined) {
                    console.warn(`Movimiento con amount inválido: ${movement.id}, amount: ${movement.amount}`);
                    return;
                }

                const date = new Date(movement.transactionDate);
                const month = months[date.getMonth()];
                if (monthlyData.has(month)) {
                    if (movement.movementType === 'income') {
                        monthlyData.get(month)!.ingresos += amount;
                    } else if (movement.movementType === 'expense') {
                        monthlyData.get(month)!.gastos += Math.abs(amount);
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
        } catch (error) {
            console.error('Error en getIncomeVsExpenses:', error);
            return res.status(500).json({ error: 'Error al obtener datos de ingresos vs gastos' });
        }
    };

    public getCategoryExpenses = async (req: Request, res: Response, next: NextFunction): Promise<Response> => {
        try {
            const userId = (req as AuthRequest).user?.id;
            if (!userId) { return res.status(401).json({ error: 'Usuario no autenticado' }); }

            const now = new Date();
            const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

            // Mantenemos el filtro de tipo 'expense' pero no filtramos por tarjeta
            const filters: IMovementFilters = { 
                startDate, 
                endDate, 
                movementType: 'expense',
                userId 
            };
            
            console.log('[DashboardController] Buscando gastos por categoría con filtros:', filters);
            const movements: IMovement[] = await this.movementService.getMovements(filters);
            console.log(`[DashboardController] Encontrados ${movements.length} movimientos`);

            const categoryData = movements.reduce((acc: { [key: string]: number }, mov: IMovement) => {
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
                    movementCount: movements.filter(m => 
                        (m.category?.nameCategory || 'Sin categoría') === categoryName
                    ).length
                }))
                .filter(category => category.value > 0)
                .sort((a, b) => b.value - a.value);

            console.log('Datos formateados para gastos por categoría:', result);
            return res.json(result);
        } catch (error) {
            console.error('Error en getCategoryExpenses:', error);
            return res.status(500).json({ message: 'Error al obtener los datos de gastos por categoría' });
        }
    };

    private async convertScraperMovement(mov: IScraperMovement, taskId: string, defaultCardId: number): Promise<IMovementCreate> {
        const processedMov = await ScraperDataProcessor.processMovement(mov, defaultCardId);
        return {
            ...processedMov,
            metadata: {
                ...processedMov.metadata,
                scraperTaskId: taskId
            }
        };
    }

    /**
     * Obtiene los movimientos recientes, incluyendo los del scraper
     */
    public getRecentMovements = async (req: Request, res: Response, next: NextFunction): Promise<Response> => {
        try {
            const userId = (req as AuthRequest).user?.id;
            if (!userId) { return res.status(401).json({ error: 'Usuario no autenticado' }); }
            
            const limit = parseInt(req.query.limit as string) || 10;

            const filters: IMovementFilters = { userId };
            const movements: IMovement[] = await this.movementService.getMovements(filters);

            movements.sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime());
            const recentMovements = movements.slice(0, limit);

            return res.json(recentMovements);
        } catch (error) {
            console.error('Error en getRecentMovements:', error);
            return res.status(500).json({ message: 'Error al obtener los movimientos recientes' });
        }
    };

    public async processScraperMovements(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
        try {
            const userId = (req as AuthRequest).user?.id;
            if (!userId) { return res.status(401).json({ error: 'Usuario no autenticado' }); }

            const { rawMovements, defaultCardId, scraperTaskId } = req.body;
            if (!Array.isArray(rawMovements) || typeof defaultCardId !== 'number' || typeof scraperTaskId !== 'string') {
                return res.status(400).json({ message: 'Datos inválidos' });
            }

            console.log(`[DashboardController] Procesando ${rawMovements.length} movimientos del scraper`);

            const createdMovements: IMovement[] = [];
            const errors: any[] = [];

            for (const rawMov of rawMovements) {
                try {
                    const movementToCreate = await this.convertScraperMovement(rawMov as IScraperMovement, scraperTaskId, defaultCardId);
                    const newMovement = await this.movementService.createMovement(movementToCreate, userId, (req as AuthRequest).user!.planId);
                    createdMovements.push(newMovement);
                    console.log(`[DashboardController] Movimiento creado: ${newMovement.description} - ${newMovement.amount}`);
                } catch (error) {
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
            } else if (errors.length > 0) {
                return res.status(400).json({ 
                    message: 'Error al procesar todos los movimientos.',
                    errors,
                    stats
                });
            } else {
                return res.status(201).json({ 
                    message: 'Movimientos procesados exitosamente.',
                    movements: createdMovements,
                    stats
                });
            }

        } catch (error) {
            console.error('Error general en processScraperMovements:', error);
            return res.status(500).json({ message: 'Error al procesar los movimientos del scraper' });
        }
    }

    private getMovementsByCategory(movements: IMovement[]): { [key: string]: number } {
        return movements.reduce((acc, mov) => {
            const categoryName = mov.category?.nameCategory || 'Otros';
            acc[categoryName] = (acc[categoryName] || 0) + 1;
            return acc;
        }, {} as { [key: string]: number });
    }

    public getTopExpenses = async (req: Request, res: Response, next: NextFunction): Promise<Response> => {
        try {
            const userId = (req as AuthRequest).user?.id;
            if (!userId) { 
                return res.status(401).json({ error: 'Usuario no autenticado' }); 
            }
            const days = parseInt(req.query.days as string) || 30;
            const limit = parseInt(req.query.limit as string) || 5;
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - days);
            const filters: IMovementFilters = { 
                startDate, 
                endDate,
                movementType: 'expense',
                userId 
            };

            console.log('[DashboardController] Buscando top gastos con filtros:', filters);
            const movements: IMovement[] = await this.movementService.getMovements(filters);
            console.log(`[DashboardController] Encontrados ${movements.length} gastos`);
            const topExpenses = movements
                .filter(mov => mov.amount !== null && mov.amount !== undefined)
                .sort((a, b) => Math.abs(Number(b.amount)) - Math.abs(Number(a.amount)))
                .slice(0, limit)
                .map(mov => ({
                    id: mov.id,
                    description: mov.description,
                    amount: Math.abs(Number(mov.amount)),
                    transactionDate: mov.transactionDate,
                    category: mov.category?.nameCategory || 'Sin categoría',
                    card: mov.card?.nameAccount || 'Efectivo',
                    movementSource: mov.movementSource || 'manual'
                }));

            console.log(`[DashboardController] Top ${limit} gastos encontrados:`, 
                topExpenses.map(e => `${e.description}: $${e.amount} (${e.card})`));
            return res.json(topExpenses);
        } catch (error) {
            console.error('Error en getTopExpenses:', error);
            return res.status(500).json({ message: 'Error al obtener los gastos principales' });
        }
    };
    public getFinancialSummary = async (req: Request, res: Response, next: NextFunction): Promise<Response> => {
        try {
            const userId = (req as AuthRequest).user?.id;
            if (!userId) { 
                return res.status(401).json({ error: 'Usuario no autenticado' }); 
            }
            const cardService = new CardService();
            const userService = new UserService();
            const cards = await cardService.getCardsByUserId(userId);
            console.log(`[CardService] getCardsByUserId: userId=${userId}, found=${cards.length} cards`);
            cards.forEach(card => {
                console.log(`  - ID: ${card.id}, Name: ${card.nameAccount}, Status: ${card.statusAccount}`);
            });

            let totalBalance = 0;
            const cardDetails = cards.map(card => {
                const balance = Number(card.balance) || 0;
                totalBalance += balance;
                
                return {
                    id: card.id,
                    name: card.nameAccount,
                    accountHolder: card.accountHolder || 'N/A',
                    balance: balance,
                    cardTypeId: card.cardTypeId,
                    statusAccount: card.statusAccount,
                    isPositive: balance >= 0
                };
            });

            // Obtener información del plan del usuario para límites
            const user = await userService.getUserById(userId);
            
            const summary = {
                totalBalance,
                isPositive: totalBalance >= 0,
                cardCount: cards.length,
                cards: cardDetails,
                userPlanId: user?.plan_id || 1,
                lastUpdated: new Date().toISOString()
            };

            console.log(`[DashboardController] Resumen financiero generado para usuario ${userId}: Balance total $${totalBalance}`);
            return res.json(summary);
        } catch (error) {
            console.error('Error en getFinancialSummary:', error);
            return res.status(500).json({ message: 'Error al obtener el resumen financiero' });
        }
    };


} 