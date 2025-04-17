import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'dashboard',
    loadChildren: () =>
      import('./modules/dashboard/dashboard.module').then(m => m.DashboardModule),
  },
  {
    path: 'login',
    loadChildren: () =>
      import('./modules/login/login.module').then(m => m.LoginModule),
  },
  {
    path: 'register',
    loadChildren: () =>
      import('./modules/register/register.module').then(m => m.RegisterModule),
  },
  {
    path: 'profile',
    loadChildren: () =>
      import('./modules/profile/profile.module').then(m => m.ProfileModule),
  },
  {
    path: 'card',
    loadChildren: () =>
      import('./modules/card/card.module').then(m => m.CardModule),
  },
  {
    path: 'analytics',
    loadChildren: () =>
      import('./modules/analytics/analytics.module').then(m => m.AnalyticsModule),
  },
  // Redirección por defecto
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  // Ruta para manejar páginas no encontradas
  {
    path: '**',
    redirectTo: 'login',
  },
];