export interface Category {
  id?: number;
  nameCategory: string;
  keywords?: string[];
  icon?: string;
  color?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CategoryCreate {
  nameCategory: string;
  keywords?: string[];
  icon?: string;
  color?: string;
}

export interface CategoryUpdate {
  nameCategory?: string;
  keywords?: string[];
  icon?: string;
  color?: string;
} 