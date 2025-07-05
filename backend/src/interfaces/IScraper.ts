export interface IScraperMovement {
    fecha: string;           // Fecha del movimiento en formato ISO
    descripcion: string;     // Descripción del movimiento
    monto: number;          // Monto del movimiento (positivo para ingresos, negativo para gastos)
    categoria?: string;     // Categoría del movimiento (opcional)
    categoria_automatica?: string; // Categoría automática determinada por el scraper
    tipo?: string;         // Tipo de movimiento según el banco
    cuenta?: string;       // Número o identificador de la cuenta
    referencia?: string;   // Número de referencia o ID de la transacción
    estado?: string;       // Estado del movimiento (ej: "procesado", "pendiente")
    movement_type?: 'income' | 'expense'; // Tipo de movimiento procesado
  }
  
  export interface IScraperAccount {
    numero: string;        // Número de cuenta
    tipo: string;         // Tipo de cuenta (ej: "Cuenta Corriente", "Cuenta Vista")
    saldo: number;        // Saldo actual
    moneda: string;       // Tipo de moneda (ej: "CLP")
    titular: string;      // Nombre del titular
    estado?: string;      // Estado de la cuenta
  }
  
  export interface IScraperResult {
    success: boolean;
    cuentas?: IScraperAccount[];
    cards?: IScraperAccount[];  // Alias de cuentas para mantener consistencia con el frontend
    ultimos_movimientos?: IScraperMovement[];
    fecha_extraccion: string;
    message?: string;
    metadata?: {
      banco: string;
      tipo_consulta: string;
      fecha_inicio?: string;
      fecha_fin?: string;
      [key: string]: any;
    };
  }
  
  export interface IScraperStatus {
    running: boolean;
    pendingTasks: number;
    processingTasks: number;
    completedTasks: number;
    failedTasks: number;
  } 