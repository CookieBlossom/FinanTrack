export interface Subscription {
  id?: number;
  userId: number;
  categoryId?: number;
  name: string;
  amount: number;
  description?: string;
  billingPeriod: 'monthly' | 'yearly' | 'weekly';
  nextBillingDate: Date;
  paymentMethodId?: number; // ID de la tarjeta
  status: 'active' | 'paused' | 'cancelled';
  createdAt?: Date;
  updatedAt?: Date;
  
  // Propiedades expandidas para la UI
  category?: {
    id: number;
    nameCategory: string;
    icon?: string;
    color?: string;
  };
  paymentMethod?: {
    id: number;
    nameAccount: string;
    aliasAccount?: string;
  };
}

export interface SubscriptionCreate {
  categoryId?: number;
  name: string;
  amount: number;
  description?: string;
  billingPeriod: 'monthly' | 'yearly' | 'weekly';
  nextBillingDate: Date;
  paymentMethodId?: number;
}

export interface SubscriptionUpdate {
  categoryId?: number;
  name?: string;
  amount?: number;
  description?: string;
  billingPeriod?: 'monthly' | 'yearly' | 'weekly';
  nextBillingDate?: Date;
  paymentMethodId?: number;
  status?: 'active' | 'paused' | 'cancelled';
}

export interface SubscriptionFilters {
  categoryId?: number;
  paymentMethodId?: number;
  billingPeriod?: 'monthly' | 'yearly' | 'weekly';
  status?: 'active' | 'paused' | 'cancelled';
  minAmount?: number;
  maxAmount?: number;
  startDate?: Date;
  endDate?: Date;
} 