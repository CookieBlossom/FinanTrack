export interface IBudget {
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
}

export interface IBudgetCreate {
  categoryId?: number;
  amountLimit: number;
  period: 'monthly' | 'yearly' | 'weekly';
  startDate: Date;
  endDate?: Date;
  alertThreshold?: number;
}

export interface IBudgetUpdate extends Partial<IBudgetCreate> {
  status?: 'active' | 'completed' | 'cancelled';
} 