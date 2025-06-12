export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  countryCode: string;
  phone: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserLogin {
  email: string;
  password: string;
}

export interface UserRegister {
  email: string;
  password: string;
  firstName?: string | null;
  lastName?: string | null;
  countryCode?: string | null;
  phone?: string | null;
}

export interface UserProfileUpdate {
  firstName?: string;
  lastName?: string;
  countryCode?: string;
  phone?: string;
}

export interface UserPasswordChange {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
}

export interface AuthResponse extends ApiResponse<{ token: string; user: User }> {
  token: string;
  user: User;
} 