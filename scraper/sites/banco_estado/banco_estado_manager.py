import os
import sys
import json
import time
import redis
import logging
import traceback
from pathlib import Path
import importlib.util
import asyncio
from typing import Dict, Any

# Agregar el directorio raíz del proyecto al path de Python
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
if project_root not in sys.path:
    sys.path.append(project_root)

from scraper.models.scraper_models import ScraperTask, ScraperResult
from scraper.utils.data_processor import DataProcessor
from scraper.utils.redis_client import update_task_status, store_result

# Configurar logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('banco-estado-scraper')

class BancoEstadoScraperManager:
    def __init__(self):
        try:
            logger.debug("Iniciando conexión con Redis...")
            self.redis_client = redis.Redis(
                host=os.getenv('REDIS_HOST', 'localhost'),
                port=int(os.getenv('REDIS_PORT', 6379)),
                decode_responses=True
            )
            # Verificar conexión con Redis
            self.redis_client.ping()
            logger.debug("Conexión con Redis establecida")
        except Exception as e:
            logger.error(f"Error al conectar con Redis: {e}")
            raise

        self.should_stop = False

    def check_for_cancellation(self, task_id: str) -> bool:
        """Verifica si hay una señal de cancelación para la tarea actual"""
        try:
            control_data = self.redis_client.rpop('scraper:control')
            if control_data:
                control = json.loads(control_data)
                if control.get('action') == 'cancel' and control.get('id') == task_id:
                    logger.info(f"Tarea {task_id} cancelada")
                    update_task_status(self.redis_client, task_id, 'cancelled', 'Tarea cancelada por el usuario')
                    return True
        except Exception as e:
            logger.error(f"Error al verificar cancelación: {e}")
        return False

    async def process_task(self, task_data: str) -> None:
        """Procesa una tarea de scraping"""
        try:
            task_dict = json.loads(task_data)
            task = ScraperTask(**task_dict)
            rut = task.data.get('rut')
            password = task.data.get('password')

            if not rut or not password:
                raise ValueError("Credenciales incompletas")

            update_task_status(self.redis_client, task.id, 'processing', 'Iniciando proceso de scraping', 0)

            # Importar el scraper original
            from scraper.sites.banco_estado import banco_estado
            
            # Crear instancia del scraper
            config = banco_estado.ScraperConfig()
            config.task_id = task.id
            config.redis_host = os.getenv('REDIS_HOST', 'localhost')
            config.redis_port = int(os.getenv('REDIS_PORT', 6379))

            scraper = banco_estado.BancoEstadoScraper(config)
            
            # Ejecutar el scraper
            result = await scraper.run(task.id, task_dict)
            
            # Procesar el resultado
            if result:
                # El resultado ya viene como diccionario desde el scraper
                store_result(self.redis_client, task.id, result)
                # Luego actualizamos el estado
                update_task_status(
                    self.redis_client,
                    task.id,
                    'completed',
                    'Scraping completado exitosamente',
                    100
                )
            else:
                raise ValueError("El scraper no retornó resultados")

        except Exception as e:
            logger.error(f"Error en el scraping: {str(e)}\n{traceback.format_exc()}")
            update_task_status(
                self.redis_client,
                task.id,
                'failed',
                'Error durante el proceso de scraping',
                error=str(e)
            )

    async def run(self) -> None:
        """Ejecuta el loop principal del scraper manager"""
        logger.info("Iniciando gestor de scraping de BancoEstado")
        
        while not self.should_stop:
            try:
                # Obtener tarea de la cola
                task_data = self.redis_client.blpop('scraper:queue', timeout=1)
                
                if task_data:
                    _, task_json = task_data
                    task_dict = json.loads(task_json)
                    task = ScraperTask(**task_dict)
                    
                    # Crear la tarea en Redis
                    task_key = f"scraper:tasks:{task.id}"
                    self.redis_client.hset(task_key, 'data', task_json)
                    
                    logger.info(f"Nueva tarea recibida: {task_json}")
                    await self.process_task(task_json)
                
            except Exception as e:
                logger.error(f"Error en el loop principal: {e}")
                time.sleep(1)

def main():
    try:
        logger.debug("Iniciando aplicación...")
        manager = BancoEstadoScraperManager()
        asyncio.run(manager.run())
    except Exception as e:
        logger.error(f"Error en el gestor: {str(e)}\n{traceback.format_exc()}")

if __name__ == '__main__':
    main() 