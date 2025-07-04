#!/usr/bin/env python3
"""
Script integrador para conectar el scraper con el backend
"""
import json
import asyncio
import redis
import time
from datetime import datetime
from banco_estado_local_v2 import BancoEstadoScraper, ScraperConfig, Credentials

class ScraperIntegration:
    def __init__(self):
        self.redis_client = redis.Redis(host='localhost', port=6379, decode_responses=True)
        
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
            # Configurar el scraper
            config = ScraperConfig(
                redis_host='localhost',
                redis_port=6379,
                debug_mode=True
            )
            
            scraper = BancoEstadoScraper(config)
            credentials = Credentials(
                rut=task['data']['rut'],
                password=task['data']['password']
            )
            
            # Actualizar progreso
            await self.update_task_status(task['id'], 'processing', 'Iniciando navegador...', 20)
            
            # Importar Playwright aquí para evitar importar si no es necesario
            from playwright.async_api import async_playwright
            
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=False, slow_mo=50)
                context = await browser.new_context(
                    user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    locale="es-CL",
                    permissions=["geolocation"],
                    geolocation={"latitude": -33.4489, "longitude": -70.6693},
                    timezone_id="America/Santiago",
                    viewport={"width": 1920, "height": 1080}
                )
                
                page = await context.new_page()
                
                # Actualizar progreso
                await self.update_task_status(task['id'], 'processing', 'Haciendo login...', 30)
                
                # Login
                login_exitoso = await scraper.login_banco_estado(page, credentials)
                if not login_exitoso:
                    await browser.close()
                    return {'success': False, 'error': 'Login fallido'}
                
                # Actualizar progreso
                await self.update_task_status(task['id'], 'processing', 'Extrayendo cuentas...', 60)
                
                # Extraer cuentas
                cuentas = await scraper.extract_cuentas(page)
                
                # Actualizar progreso
                await self.update_task_status(task['id'], 'processing', 'Extrayendo movimientos...', 80)
                
                # Extraer movimientos por cuenta
                for cuenta in cuentas:
                    movimientos_cuenta = await scraper.extract_movimientos_cuenta(page, cuenta)
                    cuenta['movimientos'] = movimientos_cuenta
                
                await browser.close()
                
                # Preparar resultado
                resultado = {
                    "success": True,
                    "fecha_extraccion": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "cuentas": cuentas,
                    "total_cuentas": len(cuentas),
                    "total_movimientos": sum(len(cuenta.get('movimientos', [])) for cuenta in cuentas)
                }
                
                return resultado
                
        except Exception as e:
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