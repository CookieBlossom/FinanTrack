export interface IScraperCredentials {
  rut?: string;
  username?: string;
  password: string;
  site?: 'banco_estado'; // Puedes ampliar con otros sitios en el futuro
}

export interface IScraperTask {
  id: string;
  credentials: IScraperCredentials;
  createdAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: any;
  error?: string;
  type?: string; // Tipo de scraper (saldos, movimientos, etc.)
  site?: string; // Sitio a scrapear (banco_estado por defecto)
}

export interface IScraperTaskCreate {
  credentials: IScraperCredentials;
  type?: string; // Tipo de scraper (saldos, movimientos, etc.)
  site?: string; // Sitio a scrapear
}

export interface IScraperResult {
  success: boolean;
  cuentas?: any[];
  ultimos_movimientos?: any[];
  fecha_extraccion?: string;
  message?: string;
}

export interface IScraperStatus {
  running: boolean;
  pendingTasks: number;
  processingTasks: number;
  completedTasks: number;
  failedTasks: number;
} 