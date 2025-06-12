"""
Configuración para los scrapers
"""
from dataclasses import dataclass
from typing import Optional

@dataclass
class ScraperConfig:
    """Configuración base para los scrapers"""
    redis_host: str = 'localhost'
    redis_port: int = 6379
    task_id: Optional[str] = None
    debug: bool = False 