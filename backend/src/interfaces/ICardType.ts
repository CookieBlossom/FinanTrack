export interface ICardType {
  id?: number;
  name: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ICardTypeCreate {
  name: string;
}

export interface ICardTypeUpdate {
  name: string;
} 