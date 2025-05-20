export interface Budget {
  id?: number;
  userId: number;
  categoryId?: number;
  amountLimit: number;
  period: 'monthly' | 'yearly' | 'weekly';
  startDate: Date;
  endDate?: Date;
  alertThreshold?: number;
  status: 'active' | 'completed' | 'cancelled';
  createdAt?: Date;
  updatedAt?: Date;
  
  // Propiedades expandidas para la UI
  category?: {
    id: number;
    nameCategory: string;
    icon?: string;
    color?: string;
  };
  currentSpending?: number; // Para mostrar cuánto se ha gastado del presupuesto
  percentageUsed?: number; // Porcentaje de uso del presupuesto
}

export interface BudgetCreate {
  categoryId?: number;
  amountLimit: number;
  period: 'monthly' | 'yearly' | 'weekly';
  startDate: Date;
  endDate?: Date;
  alertThreshold?: number;
}

export interface BudgetUpdate {
  categoryId?: number;
  amountLimit?: number;
  period?: 'monthly' | 'yearly' | 'weekly';
  startDate?: Date;
  endDate?: Date;
  alertThreshold?: number;
  status?: 'active' | 'completed' | 'cancelled';
} 