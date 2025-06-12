from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from datetime import datetime

@dataclass
class ScraperTask:
    id: str
    user_id: int
    type: str
    status: str = 'pending'
    message: Optional[str] = None
    progress: float = 0.0
    result: Optional[Dict[str, Any]] = None
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())
    error: Optional[str] = None
    data: Optional[Dict[str, Any]] = None

@dataclass
class ScraperMovement:
    fecha: str
    descripcion: str
    monto: float
    tipo: str
    cuenta: str
    estado: str = 'pendiente'

@dataclass
class ScraperAccount:
    numero: str
    tipo: str
    saldo: float
    moneda: str = 'CLP'
    titular: str = ''
    estado: str = 'activa'

@dataclass
class ScraperResult:
    success: bool
    fecha_extraccion: str = field(default_factory=lambda: datetime.now().isoformat())
    message: Optional[str] = None
    cuentas: List[ScraperAccount] = field(default_factory=list)
    ultimos_movimientos: List[ScraperMovement] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=lambda: {
        'banco': 'banco_estado',
        'tipo_consulta': 'movimientos_recientes'
    }) 