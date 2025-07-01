export type CategoryType =
  | 'Comida'
  | 'Entretenimiento'
  | 'Transporte'
  | 'Vivienda'
  | 'Salud'
  | 'Compras'
  | 'Educación'
  | 'Otros';

  export interface Category {
    id: number;
    name_category: string;
    color: string;
    is_system: boolean;
    created_at: Date;
    updated_at: Date | null;
    keywords?: string[];
  }

  export interface CategoryExpense {
    id: number;
    name_category: string;
    total_amount: number;
    transaction_count: number;
    payment_type: 'card' | 'cash';
  }
  

  export interface CategoryUpdate {
    nameCategory?: string;
    color?: string;
  }
  export interface UserCategoryKeyword {
    user_id: number;
    category_id: number;
    keywords: string[];
    updated_at: Date;
  }

  export interface CategoryCreate {
    nameCategory: string;
    color?: string;
  }