"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisService = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
// import { ConfigService } from '@nestjs/config'; // No se usa directamente en Express, usamos process.env
// import { Injectable, OnModuleDestroy } from '@nestjs/common'; // No es necesario para Express
// Cargar dotenv para asegurar que process.env esté poblado
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// @Injectable() // No es necesario para Express
class RedisService {
    constructor() {
        // Debug: mostrar configuración de Redis
        console.log('=== DEBUG REDIS CONFIG ===');
        console.log('REDIS_URL:', process.env.REDIS_URL ? 'SET' : 'NOT SET');
        console.log('REDIS_HOST:', process.env.REDIS_HOST || 'NOT SET');
        console.log('REDIS_PORT:', process.env.REDIS_PORT || 'NOT SET');
        if (process.env.REDIS_URL) {
            console.log('REDIS_URL value:', process.env.REDIS_URL);
        }
        console.log('===============================');
        if (process.env.REDIS_URL) {
            this.client = new ioredis_1.default(process.env.REDIS_URL);
            this.subscriber = new ioredis_1.default(process.env.REDIS_URL);
        }
        else {
            const redisConfig = {
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT || '6379'),
                retryStrategy: (times) => Math.min(times * 50, 2000),
            };
            this.client = new ioredis_1.default(redisConfig);
            this.subscriber = new ioredis_1.default(redisConfig);
        }
        this.subscribers = new Map();
        this.client.on('error', (err) => {
            console.error('Redis Client Error:', err);
        });
        this.client.on('connect', () => {
            console.log('Redis Client Connected');
        });
        this.subscriber.on('message', (channel, message) => {
            console.log(`Redis message received on channel ${channel}:`, message);
            const listener = this.subscribers.get(channel);
            if (listener) {
                listener(channel, message);
            }
        });
        this.subscriber.on('error', (err) => {
            console.error('Redis Subscriber Error:', err);
        });
        this.subscriber.on('connect', () => {
            console.log('Redis Subscriber Connected');
        });
    }
    // async onModuleDestroy() { // Quitar si no se usa el ciclo de vida de NestJS
    //   await this.client.quit();
    // }
    // Los métodos de Redis (set, get, del, etc.) permanecen iguales
    // ... (resto de los métodos sin cambios)
    async set(key, value, ttl) {
        if (ttl) {
            return this.client.set(key, value, 'EX', ttl);
        }
        return this.client.set(key, value);
    }
    async get(key) {
        return this.client.get(key);
    }
    async del(key) {
        return this.client.del(key);
    }
    async keys(pattern) {
        return this.client.keys(pattern);
    }
    async rpush(key, value) {
        if (Array.isArray(value)) {
            return this.client.rpush(key, ...value);
        }
        return this.client.rpush(key, value);
    }
    async lpop(key) {
        return this.client.lpop(key);
    }
    async llen(key) {
        return this.client.llen(key);
    }
    async expire(key, seconds) {
        return this.client.expire(key, seconds);
    }
    async lrange(key, start, stop) {
        return this.client.lrange(key, start, stop);
    }
    async exists(key) {
        return this.client.exists(key);
    }
    async flushall() {
        return this.client.flushall();
    }
    async hSet(key, field, value) {
        return this.client.hset(key, field, value);
    }
    async hGet(key, field) {
        return this.client.hget(key, field);
    }
    // Método para desconectar manualmente si es necesario al cerrar la app Express
    async quit() {
        await this.client.quit();
        console.log('Redis Client Disconnected');
    }
    async subscribe(channel, listener) {
        console.log(`Subscribing to channel: ${channel}`);
        this.subscribers.set(channel, listener);
        await this.subscriber.subscribe(channel);
    }
    async unsubscribe(channel) {
        console.log(`Unsubscribing from channel: ${channel}`);
        this.subscribers.delete(channel);
        await this.subscriber.unsubscribe(channel);
    }
    async publish(channel, message) {
        console.log(`Publishing to channel ${channel}:`, message);
        return this.client.publish(channel, message);
    }
}
exports.RedisService = RedisService;
//# sourceMappingURL=redis.service.js.map