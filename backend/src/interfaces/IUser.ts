export interface IUser {
  id?: number;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'user' | 'admin';
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

export interface IUserResponse extends Omit<IUser, 'password'> {
  // Omitimos el password en las respuestas
}

export interface IUserLogin {
  email: string;
  password: string;
}

export interface IUserRegister extends IUserLogin {
  firstName: string;
  lastName: string;
}

// Para actualizaciones de perfil (no permite email, role, password)
export interface IUserProfileUpdate {
  firstName?: string;
  lastName?: string;
}

// Para cambio de contraseña
export interface IUserPasswordChange {
  currentPassword: string;
  newPassword: string;
}

// Para administradores
export interface IUserAdminUpdate extends IUserProfileUpdate {
  role?: 'user' | 'admin';
  isActive?: boolean;
} 