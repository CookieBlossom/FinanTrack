export type CategoryType =
  | 'Comida'
  | 'Entretenimiento'
  | 'Transporte'
  | 'Vivienda'
  | 'Salud'
  | 'Compras'
  | 'Educación'
  | 'Otros';

export interface ICategory {
  id: number;
  name_category: string;
  color: string;
  is_system: boolean;
  created_at: Date;
  updated_at: Date | null;
  keywords?: string[]; // solo en getUserCategories
}


export interface IUserCategoryKeyword {
  user_id: number;
  category_id: number;
  keywords: string[];
  updated_at: Date;
}