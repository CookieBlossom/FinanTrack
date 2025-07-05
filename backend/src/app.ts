import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { initializeDatabase, pool } from './config/database/connection';
import router from './routes/index';
import { cronSetup } from './utils/cron-setup';

// Cargar variables de entorno
dotenv.config();
console.log('Puerto configurado:', process.env.PORT || 3000);
console.log('Base de datos:', process.env.DB_NAME || 'finantrack');

const app = express();

// Middleware
app.use(cors({
    origin: [process.env.FRONTEND_URL || 'http://localhost:4200', 'https://*.railway.app'],
    methods: ['GET', 'HEAD', 'PATCH' ,'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma', 'Expires', 'X-Timestamp'],
    credentials: true
}));

// Middleware para manejar el body raw de Stripe webhook
app.use('/stripe/webhook', express.raw({ type: 'application/json' }));

// Middleware para JSON en todas las demás rutas
app.use(express.json());

// Rutas de la API
app.use('/', router);

// Ruta de prueba para verificar que el servidor está funcionando
app.get('/', (req: Request, res: Response) => {
    res.json({ message: 'Servidor FinanTrack funcionando correctamente' });
});

// Ruta de prueba para la base de datos
app.get('/health', async (req: Request, res: Response) => {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT NOW()');
        client.release();
        console.log('Prueba de conexión exitosa:', result.rows[0].now);
        res.json({
            success: true,
            message: 'Conexión a PostgreSQL exitosa',
            timestamp: result.rows[0].now
        });
    } catch (error) {
        console.error('Error al probar la conexión:', error);
        res.status(500).json({
            success: false,
            message: 'Error al conectar con la base de datos',
            error: error instanceof Error ? error.message : 'Error desconocido'
        });
    }
});

// Ruta para ejecutar procesamiento manual (solo para desarrollo)
if (process.env.NODE_ENV === 'development') {
    app.post('/dev/run-automation', async (req: Request, res: Response) => {
        try {
            await cronSetup.runManualProcessing();
            res.json({ success: true, message: 'Procesamiento manual ejecutado' });
        } catch (error) {
            res.status(500).json({ 
                success: false, 
                message: 'Error en procesamiento manual',
                error: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    });
}

cronSetup.initCronJobs();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor FinanTrack ejecutándose en el puerto ${PORT}`);
    console.log(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
}); 