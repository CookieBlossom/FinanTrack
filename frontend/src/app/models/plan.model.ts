export interface Plan {
  id: number;
  name: string;
  description: string;
  createdAt: Date;
  limits: PlanLimit[];
  permissions: string[];
  features: string[];
}

export interface PlanLimit {
  limitKey: string;
  limitValue: number;
}

export interface PlanPermission {
  permissionKey: string;
  description?: string;
}

export interface UserPlan {
  planId: number;
  planName: string;
  limits: Record<string, number>;
  permissions: string[];
}

export interface PlanUsage {
  manual_movements: {
    used: number;
    limit: number;
    remaining: number;
  };
  max_cards: {
    used: number;
    limit: number;
    remaining: number;
  };
  keywords_per_category: {
    used: number;
    limit: number;
    remaining: number;
  };
  cartola_movements: {
    used: number;
    limit: number;
    remaining: number;
  };
  scraper_movements: {
    used: number;
    limit: number;
    remaining: number;
  };
}

export interface PlanLimitStatus {
  limitKey: string;
  currentUsage: number;
  limit: number;
  remaining: number;
  isUnlimited: boolean;
  percentageUsed: number;
}

export interface PaymentSession {
  id: string;
  userId: number;
  planId: number;
  planName: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
}

export interface PlansPageResponse {
  success: boolean;
  plans: Plan[];
}

export interface AuthStatusResponse {
  success: boolean;
  authenticated: boolean;
  action: 'register' | 'payment';
  user?: {
    id: number;
    email: string;
    currentPlan: string;
    currentPlanId: number;
  };
  message: string;
}

export interface InitiatePaymentRequest {
  planId: number;
}

export interface InitiatePaymentResponse {
  success: boolean;
  message: string;
  paymentSession: PaymentSession;
  redirectUrl: string;
}

export interface ConfirmPaymentRequest {
  sessionId: string;
  planId: number;
}

export interface ConfirmPaymentResponse {
  success: boolean;
  message: string;
  newPlanId: number;
}

// Constantes para las claves de límites (actualizadas para coincidir con el backend)
export const PLAN_LIMITS = {
  MANUAL_MOVEMENTS: 'manual_movements',
  MAX_CARDS: 'max_cards',
  KEYWORDS_PER_CATEGORY: 'keywords_per_category',
  CARTOLA_MOVEMENTS: 'cartola_movements',
  SCRAPER_MOVEMENTS: 'scraper_movements',
  MONTHLY_CARTOLAS: 'monthly_cartolas',
  MONTHLY_SCRAPES: 'monthly_scrapes'
} as const;

// Constantes para las claves de permisos (actualizadas para coincidir con el backend)
export const PLAN_PERMISSIONS = {
  MANUAL_MOVEMENTS: 'manual_movements',
  MANUAL_CARDS: 'manual_cards',
  BASIC_CATEGORIZATION: 'basic_categorization',
  ADVANCED_CATEGORIZATION: 'advanced_categorization',
  CARTOLA_UPLOAD: 'cartola_upload',
  SCRAPER_ACCESS: 'scraper_access',
  AUTOMATED_CATEGORIZATION: 'automated_categorization',
  EXPORT_DATA: 'export_data',
  API_ACCESS: 'api_access',
  EXECUTIVE_DASHBOARD: 'executive_dashboard',
  EMAIL_SUPPORT: 'email_support',
  PRIORITY_SUPPORT: 'priority_support'
} as const;

// Constantes para los nombres de planes (actualizadas para coincidir con el backend)
export const PLAN_NAMES = {
  FREE: 'free',
  BASIC: 'basic',
  PREMIUM: 'premium',
  PRO: 'pro'
} as const;

// Precios de los planes (actualizados)
export const PLAN_PRICES = {
  [PLAN_NAMES.FREE]: 0,
  [PLAN_NAMES.BASIC]: 9990,
  [PLAN_NAMES.PREMIUM]: 19990,
  [PLAN_NAMES.PRO]: 29990
} as const; 