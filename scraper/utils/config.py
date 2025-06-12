"""
Configuración para los scrapers
"""
from dataclasses import dataclass
import os
from typing import Optional

@dataclass
class ScraperConfig:
    """Configuración base para los scrapers"""
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379")
    task_id: Optional[str] = None
    debug: bool = bool(os.getenv("DEBUG", "0") == "1")