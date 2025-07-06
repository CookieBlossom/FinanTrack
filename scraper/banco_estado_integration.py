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
from urllib.parse import urlparse
from sites.banco_estado.banco_estado_local_v2 import BancoEstadoScraper, ScraperConfig, Credentials

class ScraperIntegration:
    def __init__(self):
        # Configuración automática para Railway/local
        redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379')
        
        print(f"[DEBUG] REDIS_URL: {redis_url}")
        
        try:
            # Parse URL correctamente usando urllib.parse
            parsed_url = urlparse(redis_url)
            
            redis_host = parsed_url.hostname or 'localhost'
            redis_port = parsed_url.port or 6379
            redis_password = parsed_url.password
            redis_username = parsed_url.username or 'default'
            
            print(f"[DEBUG] Redis config: host={redis_host}, port={redis_port}, username={redis_username}")
            
            # Configurar cliente Redis
            redis_config = {
                'host': redis_host,
                'port': redis_port,
                'decode_responses': True,
                'socket_connect_timeout': 5,
                'socket_timeout': 5,
                'retry_on_timeout': True
            }
            
            if redis_password:
                redis_config['password'] = redis_password
                if redis_username != 'default':
                    redis_config['username'] = redis_username
            
            self.redis_client = redis.Redis(**redis_config)
            print(f"[INFO] Configuración Redis: {redis_host}:{redis_port}")
            
        except Exception as e:
            print(f"[ERROR] Error parseando REDIS_URL: {e}")
            # Fallback a configuración local
            self.redis_client = redis.Redis(host='localhost', port=6379, decode_responses=True)
            print("[INFO] Usando configuración Redis local como fallback")
        
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
                
                try:
                    # Ejecutar scraping
                    result = await self.execute_scraping(task)
                    
                    if result['success']:
                        # Actualizar estado a "completado"
                        await self.update_task_status(task['id'], 'completed', 'Scraping completado', 100, result)
                        print(f"[OK] Tarea {task['id']} completada exitosamente")
                    else:
                        # Actualizar estado a "fallido"
                        error_message = result.get('error', 'Error desconocido')
                        await self.update_task_status(task['id'], 'failed', error_message, 0)
                        print(f"ERROR: Tarea {task['id']} falló: {error_message}")
                        
                except Exception as scraping_error:
                    # Error crítico durante el scraping
                    error_message = f"Error crítico: {str(scraping_error)}"
                    await self.update_task_status(task['id'], 'failed', error_message, 0)
                    print(f"ERROR: Error crítico en tarea {task['id']}: {scraping_error}")
                    import traceback
                    traceback.print_exc()
                
            except json.JSONDecodeError as json_error:
                print(f"ERROR: Error decodificando JSON de tarea: {json_error}")
                await asyncio.sleep(5)
            except Exception as e:
                print(f"ERROR: Error procesando tarea: {e}")
                # Si tenemos el ID de la tarea, actualizar su estado
                if 'task' in locals() and 'id' in task:
                    try:
                        await self.update_task_status(task['id'], 'failed', f"Error del procesador: {str(e)}", 0)
                    except Exception as update_error:
                        print(f"ERROR: No se pudo actualizar estado de tarea fallida: {update_error}")
                await asyncio.sleep(10)
    
    async def execute_scraping(self, task):
        """Ejecuta el scraping usando tu scraper actual"""
        try:
            # Configurar el scraper según el entorno
            redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379')
            
            # Parse URL correctamente usando urllib.parse
            parsed_url = urlparse(redis_url)
            redis_host = parsed_url.hostname or 'localhost'
            redis_port = parsed_url.port or 6379
            
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
        max_retries = 3
        retry_delay = 1  # segundos
        
        for attempt in range(max_retries):
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
                    'updated_at': datetime.now().isoformat()
                })
                
                # Solo agregar resultado si se proporciona
                if result is not None:
                    task['result'] = result
                
                # Si hay error, agregarlo
                if status == 'failed' and result is None:
                    task['error'] = message
                
                # Guardar en Redis
                self.redis_client.hset(f'scraper:tasks:{task_id}', 'data', json.dumps(task))
                
                print(f"[INFO] Tarea {task_id}: {status} - {message} ({progress}%)")
                return  # Éxito, salir del bucle de reintentos
                
            except redis.ConnectionError as redis_error:
                print(f"ERROR: Error de conexión Redis (intento {attempt + 1}/{max_retries}): {redis_error}")
                if attempt < max_retries - 1:
                    await asyncio.sleep(retry_delay * (attempt + 1))  # Backoff exponencial
                else:
                    print(f"ERROR: No se pudo actualizar tarea {task_id} después de {max_retries} intentos")
            except json.JSONDecodeError as json_error:
                print(f"ERROR: Error JSON al actualizar tarea {task_id}: {json_error}")
                break  # No reintentar errores de JSON
            except Exception as e:
                print(f"ERROR: Error inesperado actualizando tarea {task_id}: {e}")
                if attempt < max_retries - 1:
                    await asyncio.sleep(retry_delay * (attempt + 1))
                else:
                    print(f"ERROR: Fallo definitivo actualizando tarea {task_id}")

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