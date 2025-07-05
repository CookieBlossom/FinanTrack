#!/usr/bin/env python3
"""
Script integrador para conectar el scraper con el backend
"""
import json
import asyncio
import redis
import time
import os
from datetime import datetime
from sites.banco_estado.banco_estado_local_v2 import BancoEstadoScraper, ScraperConfig, Credentials

class ScraperIntegration:
    def __init__(self):
        # Configuración automática para Railway/local
        redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379')
        
        if redis_url.startswith('redis://'):
            # Parse Redis URL
            redis_info = redis_url.replace('redis://', '').split(':')
            if len(redis_info) >= 2:
                redis_host = redis_info[0]
                redis_port = int(redis_info[1].split('/')[0])
            else:
                redis_host = 'localhost'
                redis_port = 6379
        else:
            redis_host = 'localhost'
            redis_port = 6379
            
        self.redis_client = redis.Redis(host=redis_host, port=redis_port, decode_responses=True)
        print(f"[INFO] Configuración Redis: {redis_host}:{redis_port}")
        
    async def process_tasks(self):
        """Procesa tareas de la cola de Redis"""
        print("[SCRAPER] Iniciando procesador de tareas...")
        
        while True:
            try:
                # Obtener tarea de la cola
                task_data = self.redis_client.lpop('scraper:queue')
                
                if not task_data:
                    # No hay tareas, esperar
                    await asyncio.sleep(5)
                    continue
                
                task = json.loads(task_data)
                print(f"[INFO] Procesando tarea: {task['id']}")
                
                # Actualizar estado a "procesando"
                await self.update_task_status(task['id'], 'processing', 'Iniciando scraping...', 10)
                
                # Ejecutar scraping
                result = await self.execute_scraping(task)
                
                if result['success']:
                    # Actualizar estado a "completado"
                    await self.update_task_status(task['id'], 'completed', 'Scraping completado', 100, result)
                    print(f"[OK] Tarea {task['id']} completada exitosamente")
                else:
                    # Actualizar estado a "fallido"
                    await self.update_task_status(task['id'], 'failed', result.get('error', 'Error desconocido'), 0)
                    print(f"ERROR: Tarea {task['id']} falló: {result.get('error')}")
                
            except Exception as e:
                print(f"ERROR: Error procesando tarea: {e}")
                if 'task' in locals():
                    await self.update_task_status(task['id'], 'failed', str(e), 0)
                await asyncio.sleep(10)
    
    async def execute_scraping(self, task):
        """Ejecuta el scraping usando tu scraper actual"""
        try:
            # Configurar el scraper según el entorno
            redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379')
            redis_info = redis_url.replace('redis://', '').split(':')
            
            if len(redis_info) >= 2:
                redis_host = redis_info[0]
                redis_port = int(redis_info[1].split('/')[0])
            else:
                redis_host = 'localhost'
                redis_port = 6379
            
            config = ScraperConfig(
                redis_host=redis_host,
                redis_port=redis_port,
                debug_mode=True
            )
            
            scraper = BancoEstadoScraper(config)
            
            # Usar el método run del scraper que ya tiene toda la lógica
            result = await scraper.run(task['id'], task)
            
            return result
                
        except Exception as e:
            print(f"ERROR: Error en execute_scraping: {e}")
            import traceback
            traceback.print_exc()
            return {'success': False, 'error': str(e)}
    
    async def update_task_status(self, task_id, status, message, progress, result=None):
        """Actualiza el estado de una tarea en Redis"""
        try:
            # Obtener tarea actual
            task_data = self.redis_client.hget(f'scraper:tasks:{task_id}', 'data')
            if task_data:
                task = json.loads(task_data)
            else:
                task = {'id': task_id}
            
            # Actualizar campos
            task.update({
                'status': status,
                'message': message,
                'progress': progress,
                'updated_at': datetime.now().isoformat(),
                'result': result
            })
            
            # Guardar en Redis
            self.redis_client.hset(f'scraper:tasks:{task_id}', 'data', json.dumps(task))
            
            print(f"[INFO] Tarea {task_id}: {status} - {message} ({progress}%)")
            
        except Exception as e:
            print(f"ERROR: Error actualizando tarea {task_id}: {e}")

async def main():
    """Función principal"""
    integration = ScraperIntegration()
    
    print("[SCRAPER] Iniciando integración del scraper...")
    print("[INFO] Conectando a Redis...")
    
    try:
        # Verificar conexión a Redis
        integration.redis_client.ping()
        print("[OK] Conexión a Redis exitosa")
        
        # Procesar tareas
        await integration.process_tasks()
        
    except redis.ConnectionError:
        print("ERROR: Error: No se pudo conectar a Redis. Asegúrate de que Redis esté ejecutándose.")
    except KeyboardInterrupt:
        print("\n[INFO] Deteniendo procesador de tareas...")
    except Exception as e:
        print(f"ERROR: Error crítico: {e}")

if __name__ == "__main__":
    asyncio.run(main()) 