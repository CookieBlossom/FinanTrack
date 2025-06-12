export interface ScraperResult {
  success: boolean;
  status?: string;
  progress?: number;
  message?: string;
  cards?: Array<{
    number: string;
    type: string;
    bank: string;
    balance?: number;
    lastFourDigits?: string;
    [key: string]: any;
  }>;
}

export interface ScraperTask {
  taskId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  message?: string;
  result?: ScraperResult;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScraperCredentials {
  rut: string;
  password: string;
  site?: string;
}

export interface ScraperResponse<T> {
  success: boolean;
  message: string;
  data?: T;
} 