export interface CardType {
  id?: number;
  name: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CardTypeCreate {
  name: string;
}

export interface CardTypeUpdate {
  name: string;
} 