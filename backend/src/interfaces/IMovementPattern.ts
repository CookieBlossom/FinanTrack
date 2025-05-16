export interface IMovementPattern {
  id?: number;
  categoryId: number;
  patternText: string;
  priority?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IMovementPatternCreate {
  categoryId: number;
  patternText: string;
  priority?: number;
}

export interface IMovementPatternUpdate extends Partial<IMovementPatternCreate> {} 