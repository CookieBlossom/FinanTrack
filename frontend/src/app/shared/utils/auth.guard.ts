import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthTokenService } from '../../services/auth-token.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(
    private router: Router,
    private authTokenService: AuthTokenService
  ) {}

  canActivate(): boolean {
    if (!this.authTokenService.hasToken()) {
      this.router.navigate(['/login']);
      return false;
    }
    return true;
  }
} 