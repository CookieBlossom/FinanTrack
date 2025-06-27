import cron from 'node-cron';
import axios from 'axios';
import { config } from '../config/config';
export class CronSetup {
    private baseUrl: string;

    constructor() {
        // Usar la URL del frontend desde las variables de entorno o configurar por defecto
        this.baseUrl = process.env.FRONTEND_URL 
            ? `${process.env.FRONTEND_URL.replace('4200', '3000')}`
            : 'http://localhost:3000';
    }

    initCronJobs(): void {
        console.log('Inicializando cron jobs...');
        
        // Procesamiento diario de movimientos proyectados (6:00 AM)
        this.setupProjectedMovementsCron();
        
        // Limpieza semanal de datos antiguos (Domingo 2:00 AM)
        this.setupCleanupCron();
        
        console.log('Cron jobs inicializados correctamente');
    }

    /**
     * Configura el cron job para procesamiento de movimientos proyectados
     */
    private setupProjectedMovementsCron(): void {
        // Ejecutar todos los días a las 6:00 AM
        cron.schedule('0 6 * * *', async () => {
            console.log('Ejecutando procesamiento automático de movimientos proyectados...');
            
            try {
                const response = await axios.post(`${this.baseUrl}/automation/run-scheduled`);
                
                if (response.data.success) {
                    console.log('Procesamiento automático completado exitosamente');
                    
                    const result = response.data.data;
                    if (result.processed > 0) {
                        console.log(`Movimientos procesados: ${result.processed}`);
                        console.log(`Movimientos omitidos: ${result.skipped}`);
                        console.log(`Errores: ${result.errors}`);
                    }
                } else {
                    console.error('Error en procesamiento automático:', response.data.message);
                }
            } catch (error) {
                console.error('Error ejecutando cron job de movimientos proyectados:', error);
            }
        }, {
            scheduled: true,
            timezone: "America/Santiago" // Zona horaria de Chile
        });

        console.log('Cron job de movimientos proyectados configurado (diario a las 6:00 AM)');
    }

    /**
     * Configura el cron job para limpieza de datos
     */
    private setupCleanupCron(): void {
        // Ejecutar todos los domingos a las 2:00 AM
        cron.schedule('0 2 * * 0', async () => {
            console.log('Ejecutando limpieza semanal de datos...');
            
            try {
                // Aquí se pueden agregar tareas de limpieza
                // Por ejemplo: limpiar logs antiguos, archivos temporales, etc.
                console.log('Limpieza semanal completada');
            } catch (error) {
                console.error('Error en limpieza semanal:', error);
            }
        }, {
            scheduled: true,
            timezone: "America/Santiago"
        });

        console.log('Cron job de limpieza configurado (domingos a las 2:00 AM)');
    }

    /**
     * Ejecuta el procesamiento manualmente (para pruebas)
     */
    async runManualProcessing(): Promise<void> {
        try {
            console.log('Ejecutando procesamiento manual...');
            
            const response = await axios.post(`${this.baseUrl}/automation/run-scheduled`);
            
            if (response.data.success) {
                console.log('Procesamiento manual completado exitosamente');
                console.log('Resultados:', response.data.data);
            } else {
                console.error('Error en procesamiento manual:', response.data.message);
            }
        } catch (error) {
            console.error('Error ejecutando procesamiento manual:', error);
        }
    }

    /**
     * Obtiene estadísticas de automatización
     */
    async getAutomationStats(): Promise<any> {
        try {
            const response = await axios.get(`${this.baseUrl}/automation/stats`);
            
            if (response.data.success) {
                return response.data.data;
            } else {
                console.error('Error obteniendo estadísticas:', response.data.message);
                return null;
            }
        } catch (error) {
            console.error('Error obteniendo estadísticas de automatización:', error);
            return null;
        }
    }
}

// Exportar instancia singleton
export const cronSetup = new CronSetup(); 