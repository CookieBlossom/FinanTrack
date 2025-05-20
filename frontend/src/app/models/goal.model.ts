export interface Goal {
  id?: number;
  userId: number;
  categoryId: number;
  amountExpected: number;
  amountActual: number;
  goalPeriod: 'monthly' | 'yearly' | 'weekly';
  deadline: Date;
  goalDescription?: string;
  createdAt?: Date;
  updatedAt?: Date;
  
  // Propiedades expandidas para la UI
  category?: {
    id: number;
    nameCategory: string;
    icon?: string;
    color?: string;
  };
  progressPercentage?: number; // Porcentaje de progreso hacia la meta
  daysRemaining?: number; // Días restantes hasta la fecha límite
}

export interface GoalCreate {
  categoryId: number;
  amountExpected: number;
  goalPeriod: 'monthly' | 'yearly' | 'weekly';
  deadline: Date;
  goalDescription?: string;
}

export interface GoalUpdate {
  categoryId?: number;
  amountExpected?: number;
  amountActual?: number;
  goalPeriod?: 'monthly' | 'yearly' | 'weekly';
  deadline?: Date;
  goalDescription?: string;
} 