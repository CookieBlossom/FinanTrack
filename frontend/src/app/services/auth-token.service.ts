import { Injectable } from '@angular/core';
import { jwtDecode } from 'jwt-decode';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthTokenService {
  private readonly TOKEN_KEY = 'token';

  constructor(private router: Router) { }

  setToken(token: string): void {
    if (!token) {
      console.error('Intento de guardar token nulo o vacío');
      throw new Error('Token no válido');
    }
    try {
      // Limpiar el token de espacios y caracteres inválidos
      const cleanToken = token.trim();
      // Verificar que el token sea válido antes de guardarlo
      const decoded = jwtDecode(cleanToken);
      if (!decoded) {
        console.error('Token inválido al intentar decodificarlo');
        throw new Error('Token inválido');
      }
      console.log('Token decodificado:', decoded);
      localStorage.setItem(this.TOKEN_KEY, cleanToken);
    } catch (error) {
      console.error('Error al guardar el token:', error);
      throw new Error('Token inválido');
    }
  }

  getToken(): string | null {
    const token = localStorage.getItem(this.TOKEN_KEY);
    console.log('Obteniendo token:', token ? 'Token encontrado' : 'No hay token');
    
    if (!token) {
      return null;
    }

    try {
      // Verificar que el token no haya expirado
      const decoded = jwtDecode(token);
      const currentTime = Date.now() / 1000;
      
      if (decoded.exp && decoded.exp < currentTime) {
        console.log('Token expirado, eliminando...');
        this.removeToken();
        return null;
      }
      
      return token;
    } catch (error) {
      console.error('Error al verificar el token:', error);
      this.removeToken();
      return null;
    }
  }

  removeToken(): void {
    console.log('Eliminando token de localStorage');
    localStorage.removeItem(this.TOKEN_KEY);
  }

  hasToken(): boolean {
    const token = this.getToken();
    console.log('Verificando si existe token:', token ? 'Sí' : 'No');
    return token !== null;
  }

  isTokenValid(): boolean {
    const token = this.getToken();
    console.log('Validando token:', token ? 'Token presente' : 'No hay token');
    
    if (!token) {
      return false;
    }
    
    try {
      const decoded = jwtDecode(token);
      const currentTime = Date.now() / 1000;
      const isValid = decoded.exp ? decoded.exp > currentTime : false;
      console.log('Token válido:', isValid, 'Expira en:', decoded.exp);
      return isValid;
    } catch (error) {
      console.error('Error al validar el token:', error);
      return false;
    }
  }

  getDecodedToken(): any {
    const token = this.getToken();
    if (!token) {
      return null;
    }

    try {
      return jwtDecode(token);
    } catch (error) {
      console.error('Error al decodificar el token:', error);
      return null;
    }
  }

  getUserId(): string | null {
    const token = this.getToken();
    if (!token) return null;
    
    try {
      const decodedToken = jwtDecode(token);
      return (decodedToken as any).id || null;
    } catch (error) {
      console.error('Error al decodificar el token:', error);
      return null;
    }
  }
} 