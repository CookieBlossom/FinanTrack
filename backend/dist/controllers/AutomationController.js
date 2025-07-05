"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutomationController = void 0;
const automation_service_1 = require("../services/automation.service");
class AutomationController {
    constructor() {
        /**
         * Ejecuta el procesamiento automático de movimientos proyectados
         * Endpoint para ejecución manual o programada
         */
        this.runProcessing = async (req, res) => {
            try {
                console.log('Solicitud de procesamiento automático recibida');
                const result = await this.automationService.processOverdueProjectedMovements();
                res.json({
                    success: true,
                    message: 'Procesamiento automático completado',
                    data: result
                });
            }
            catch (error) {
                console.error('Error en procesamiento automático:', error);
                res.status(500).json({
                    success: false,
                    message: 'Error al ejecutar el procesamiento automático',
                    error: error instanceof Error ? error.message : 'Error desconocido'
                });
            }
        };
        /**
         * Obtiene estadísticas de automatización
         */
        this.getStats = async (req, res) => {
            try {
                const stats = await this.automationService.getAutomationStats();
                res.json({
                    success: true,
                    data: stats
                });
            }
            catch (error) {
                console.error('Error obteniendo estadísticas de automatización:', error);
                res.status(500).json({
                    success: false,
                    message: 'Error al obtener estadísticas de automatización',
                    error: error instanceof Error ? error.message : 'Error desconocido'
                });
            }
        };
        /**
         * Ejecuta el procesamiento programado
         * Este endpoint puede ser llamado por un cron job
         */
        this.runScheduledProcessing = async (req, res) => {
            try {
                await this.automationService.runScheduledProcessing();
                res.json({
                    success: true,
                    message: 'Procesamiento programado ejecutado correctamente'
                });
            }
            catch (error) {
                console.error('Error en procesamiento programado:', error);
                res.status(500).json({
                    success: false,
                    message: 'Error al ejecutar el procesamiento programado',
                    error: error instanceof Error ? error.message : 'Error desconocido'
                });
            }
        };
        /**
         * Procesa movimientos específicos de un usuario
         */
        this.processUserMovements = async (req, res) => {
            try {
                const userId = req.user?.id;
                if (!userId) {
                    res.status(401).json({
                        success: false,
                        message: 'Usuario no autenticado'
                    });
                    return;
                }
                // Por ahora, procesamos todos los movimientos vencidos
                // En el futuro se puede agregar lógica específica por usuario
                const result = await this.automationService.processOverdueProjectedMovements();
                // Filtrar solo los movimientos del usuario
                const userMovements = result.details.filter(d => d.userId === userId);
                res.json({
                    success: true,
                    message: 'Procesamiento de movimientos del usuario completado',
                    data: {
                        ...result,
                        details: userMovements
                    }
                });
            }
            catch (error) {
                console.error('Error procesando movimientos del usuario:', error);
                res.status(500).json({
                    success: false,
                    message: 'Error al procesar movimientos del usuario',
                    error: error instanceof Error ? error.message : 'Error desconocido'
                });
            }
        };
        this.automationService = new automation_service_1.AutomationService();
    }
}
exports.AutomationController = AutomationController;
//# sourceMappingURL=AutomationController.js.map