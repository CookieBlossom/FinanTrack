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
    }
}; 