import Redis from 'ioredis';
// import { ConfigService } from '@nestjs/config'; // No se usa directamente en Express, usamos process.env
// import { Injectable, OnModuleDestroy } from '@nestjs/common'; // No es necesario para Express

// Cargar dotenv para asegurar que process.env esté poblado
import dotenv from 'dotenv';
dotenv.config();

// @Injectable() // No es necesario para Express
export class RedisService { // quitamos OnModuleDestroy por ahora, manejar desconexión si es necesario en app.ts
  private readonly client: Redis;

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
    
    // Si existe REDIS_URL, úsala. Si no, usa host y puerto.
    this.client = process.env.REDIS_URL
      ? new Redis(process.env.REDIS_URL)
      : new Redis({
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          retryStrategy: (times) => Math.min(times * 50, 2000),
        });
  
    this.client.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });
  
    this.client.on('connect', () => {
      console.log('Redis Client Connected');
    });
  }
  // async onModuleDestroy() { // Quitar si no se usa el ciclo de vida de NestJS
  //   await this.client.quit();
  // }

  // Los métodos de Redis (set, get, del, etc.) permanecen iguales
  // ... (resto de los métodos sin cambios)
  async set(key: string, value: string, ttl?: number): Promise<'OK'> {
    if (ttl) {
      return this.client.set(key, value, 'EX', ttl);
    }
    return this.client.set(key, value);
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async del(key: string): Promise<number> {
    return this.client.del(key);
  }

  async keys(pattern: string): Promise<string[]> {
    return this.client.keys(pattern);
  }

  async rpush(key: string, value: string | string[]): Promise<number> {
    if (Array.isArray(value)) {
      return this.client.rpush(key, ...value);
    }
    return this.client.rpush(key, value);
  }

  async lpop(key: string): Promise<string | null> {
    return this.client.lpop(key);
  }

  async llen(key: string): Promise<number> {
    return this.client.llen(key);
  }

  async expire(key: string, seconds: number): Promise<number> {
    return this.client.expire(key, seconds);
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    return this.client.lrange(key, start, stop);
  }

  async exists(key: string): Promise<number> {
    return this.client.exists(key);
  }

  async flushall(): Promise<'OK'> {
    return this.client.flushall();
  }

  async hSet(key: string, field: string, value: string): Promise<number> {
    return this.client.hset(key, field, value);
  }

  async hGet(key: string, field: string): Promise<string | null> {
    return this.client.hget(key, field);
  }

  // Método para desconectar manualmente si es necesario al cerrar la app Express
  async quit(): Promise<void> {
    await this.client.quit();
    console.log('Redis Client Disconnected');
  }

  async subscribe(channel: string, listener: (channel: string, message: string) => void): Promise<void> {
    const subscriber = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    await subscriber.subscribe(channel);
    subscriber.on('message', listener);
  }

  async publish(channel: string, message: string): Promise<number> {
    return this.client.publish(channel, message);
  }
} 