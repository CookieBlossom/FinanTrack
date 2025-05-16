import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { initializeDatabase, pool } from './config/database/connection';

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Ruta de prueba para la base de datos
app.get('/api/test-db', async (req: Request, res: Response) => {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT NOW()');
        client.release();
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
initializeDatabase()
    .then(() => {
        console.log('Base de datos inicializada correctamente');
    })
    .catch(error => {
        console.error('Error al inicializar la base de datos:', error);
        process.exit(1);
    });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
}); 