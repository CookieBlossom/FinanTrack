export interface IUser {
  id?: number;
  email: string;
  password: string;
  firstName?: string | null;
  lastName?: string | null;
  countryCode?: string | null;
  phone?: string | null;
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

export interface IUserRegister {
  email: string;
  password: string;
  firstName?: string | null;
  lastName?: string | null;
  countryCode?: string | null;
  phone?: string | null;
  // Soporte para snake_case
  first_name?: string | null;
  last_name?: string | null;
  country_code?: string | null;
}

// Para actualizaciones de perfil (no permite email, role, password)
export interface IUserProfileUpdate {
  firstName?: string | null;
  lastName?: string | null;
  countryCode?: string | null;
  phone?: string | null;
  // Soporte para snake_case
  first_name?: string | null;
  last_name?: string | null;
  country_code?: string | null;
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