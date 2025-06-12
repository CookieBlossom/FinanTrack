"""
Cliente de Redis para los scrapers
"""
import json
import redis
from datetime import datetime
from typing import Optional, Dict, Any

from scraper.models.scraper_models import ScraperTask, ScraperResult

def get_task(redis_client: redis.Redis, task_id: str) -> Optional[ScraperTask]:
    """Obtiene una tarea de Redis"""
    try:
        task_key = f"scraper:tasks:{task_id}"
        task_data = redis_client.hget(task_key, 'data')
        if task_data:
            task_dict = json.loads(task_data)
            return ScraperTask(**task_dict)
        return None
    except Exception as e:
        print(f"❌ Error al obtener tarea {task_id}: {str(e)}")
        return None

def store_result(redis_client: redis.Redis, task_id: str, result: Dict[str, Any]) -> bool:
    """Almacena el resultado de una tarea en Redis"""
    try:
        task_key = f"scraper:tasks:{task_id}"
        task_data = redis_client.hget(task_key, 'data')
        if task_data:
            task_dict = json.loads(task_data)
            task_dict['status'] = 'completed'
            task_dict['progress'] = 100
            task_dict['message'] = 'Scraping completado exitosamente'
            task_dict['result'] = result
            task_dict['updated_at'] = datetime.now().isoformat()
            
            success = redis_client.hset(task_key, 'data', json.dumps(task_dict))
            print(f"✅ Resultados guardados en Redis para tarea {task_id}")
            return success
        print(f"⚠️ No se encontró la tarea {task_id} en Redis")
        return False
    except Exception as e:
        print(f"❌ Error guardando resultados en Redis: {str(e)}")
        return False

def update_task_status(redis_client: redis.Redis, task_id: str, status: str, 
                      message: Optional[str] = None, progress: Optional[float] = None,
                      error: Optional[str] = None) -> bool:
    """Actualiza el estado de una tarea en Redis"""
    try:
        task_key = f"scraper:tasks:{task_id}"
        task_data = redis_client.hget(task_key, 'data')
        if task_data:
            task_dict = json.loads(task_data)
            task = ScraperTask(**task_dict)
            task.status = status
            if message:
                task.message = message
            if progress is not None:
                task.progress = progress
            if error:
                task.error = error
            task.updated_at = datetime.now().isoformat()
            
            success = redis_client.hset(task_key, 'data', json.dumps(task.__dict__))
            print(f"Estado de tarea actualizado: {task_id} -> {status} ({message if message else 'sin mensaje'}) - Progreso: {progress}%")
            return success
        print(f"⚠️ No se encontró la tarea {task_id} en Redis")
        return False
    except Exception as e:
        print(f"❌ Error actualizando estado de tarea {task_id}: {str(e)}")
        return False 