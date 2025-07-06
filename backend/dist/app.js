"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = require("http");
const connection_1 = require("./config/database/connection");
const index_1 = __importDefault(require("./routes/index"));
const cron_setup_1 = require("./utils/cron-setup");
const websocket_service_1 = require("./services/websocket.service");
// Cargar variables de entorno
dotenv_1.default.config();
console.log('Puerto configurado:', process.env.PORT || 3000);
console.log('Base de datos:', process.env.DB_NAME || 'finantrack');
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
const wsService = websocket_service_1.WebSocketService.getInstance();
wsService.initialize(server);
// Middleware
app.use((0, cors_1.default)({
    origin: [
        process.env.FRONTEND_URL || 'http://localhost:4200',
        'https://*.railway.app',
        'https://*.onrender.com'
    ],
    methods: ['GET', 'HEAD', 'PATCH', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma', 'Expires', 'X-Timestamp'],
    credentials: true
}));
// Middleware para manejar el body raw de Stripe webhook
app.use('/stripe/webhook', express_1.default.raw({ type: 'application/json' }));
// Middleware para JSON en todas las demás rutas
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
// Ruta para ejecutar procesamiento manual (solo para desarrollo)
if (process.env.NODE_ENV === 'development') {
    app.post('/dev/run-automation', async (req, res) => {
        try {
            await cron_setup_1.cronSetup.runManualProcessing();
            res.json({ success: true, message: 'Procesamiento manual ejecutado' });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                message: 'Error en procesamiento manual',
                error: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    });
}
cron_setup_1.cronSetup.initCronJobs();
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor FinanTrack ejecutándose en el puerto ${PORT}`);
    console.log(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
});
//# sourceMappingURL=app.js.map