"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const connection_1 = require("./config/database/connection");
const index_1 = __importDefault(require("./routes/index"));
// Cargar variables de entorno
dotenv_1.default.config();
console.log('Variables de entorno cargadas');
console.log('Puerto configurado:', process.env.PORT || 3000);
console.log('Base de datos:', process.env.DB_NAME || 'finantrack');
const app = (0, express_1.default)();
// Middleware
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || 'http://localhost:4200',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));
app.use(express_1.default.json());
// Rutas de la API
app.use('/', index_1.default);
// Ruta de prueba para verificar que el servidor está funcionando
app.get('/', (req, res) => {
    res.json({ message: 'Servidor FinanTrack funcionando correctamente' });
});
// Ruta de prueba para la base de datos
app.get('/health', async (req, res) => {
    try {
        const client = await connection_1.pool.connect();
        const result = await client.query('SELECT NOW()');
        client.release();
        console.log('Prueba de conexión exitosa:', result.rows[0].now);
        res.json({
            success: true,
            message: 'Conexión a PostgreSQL exitosa',
            timestamp: result.rows[0].now
        });
    }
    catch (error) {
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
(0, connection_1.initializeDatabase)()
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
//# sourceMappingURL=app.js.map