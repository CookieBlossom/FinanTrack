export const config = {
    jwtSecret: process.env.JWT_SECRET || '2004',
    database: {
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    },
    redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        enableOfflineQueue: false
    },
    // Configuración para automatización
    automation: {
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:4200',
        backendUrl: process.env.BACKEND_URL || 'http://localhost:3000',
        timezone: process.env.TIMEZONE || 'America/Santiago'
    },
    // Configuración general
    nodeEnv: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 3000
}; 