export interface ICategory {
  id?: number;
  nameCategory: string;
  keywords?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ICategoryCreate {
  nameCategory: string;
  keywords?: string[];
  icon?: string;
  color?: string;
}

export interface ICategoryUpdate extends Partial<ICategoryCreate> {} 