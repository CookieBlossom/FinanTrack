import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { initializeDatabase, pool } from './config/database/connection';
import router from './routes';

// Cargar variables de entorno
dotenv.config();
console.log('Variables de entorno cargadas');
console.log('Puerto configurado:', process.env.PORT || 3000);
console.log('Base de datos:', process.env.DB_NAME || 'finantrack');

const app = express();

// Middleware
app.use(cors());
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

// Inicializar la base de datos al arrancar
console.log('Intentando conectar a la base de datos...');
initializeDatabase()
    .then(() => {
        console.log('Base de datos inicializada correctamente');
        // Iniciar el servidor solo después de confirmar la conexión a la BD
        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => {
            console.log(`Servidor corriendo en http://localhost:${PORT}`);
            console.log(`Ruta de salud: http://localhost:${PORT}/health`);
        });
    })
    .catch(error => {
        console.error('Error al inicializar la base de datos:', error);
        process.exit(1);
    }); 