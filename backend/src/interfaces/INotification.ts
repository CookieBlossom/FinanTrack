export interface INotification {
  id?: number;
  userId: number;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  isRead: boolean;
  relatedEntityType?: 'movement' | 'subscription' | 'goal' | 'card';
  relatedEntityId?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface INotificationCreate {
  userId: number;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  relatedEntityType?: 'movement' | 'subscription' | 'goal' | 'card';
  relatedEntityId?: number;
}

export interface INotificationUpdate {
  isRead?: boolean;
} 