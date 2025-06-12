import { Routes } from '@angular/router';
import { LayoutComponent } from './shared/components/layout/layout.component';

// Esto carga todo lo que usa layout: dashboard, profile, etc.
export const routes: Routes = [
  // Rutas públicas (sin layout)
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./modules/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./modules/register/register.component').then(m => m.RegisterComponent),
  },
  {
    path:'about-company',
    loadComponent:() =>
      import('./modules/about-company/about-company.component').then(m => m.AboutCompanyComponent),
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./modules/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent),
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./modules/reset-password/reset-password.component').then(m => m.ResetPasswordComponent),
  },
  // Rutas privadas (con layout)
  {
    path: '',
    component: LayoutComponent,
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./modules/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'cards',
        loadComponent: () => import('./modules/card/card.component').then(m => m.CardComponent)
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./modules/profile/profile.component').then(m => m.ProfileComponent),
      },
      {
        path: 'analytics',
        loadComponent: () =>
          import('./modules/analytics/analytics.component').then(m => m.AnalyticsComponent),
      },
      {
        path: 'categories',
        loadComponent: () =>
          import('./modules/categories/categories.component').then(m => m.CategoriesComponent),
      },
      {
        path: 'movements',
        loadComponent: () =>
          import('./modules/movements/movements.component').then(m => m.MovementsComponent),
      },
      {
        path:'config',
        loadComponent:() =>
          import('./modules/config/config.component').then(m => m.ConfigComponent),
      },
      {
        path:'condiciones',
        loadComponent:() =>
          import('./modules/condiciones/condiciones.component').then(m=>m.CondicionesComponent),
      },
      {
        path:'help',
        loadComponent:()=>
          import('./modules/help/help.component').then(m =>m.HelpComponent),
      },
      {
        path: 'upcoming-transactions',
        loadComponent: () =>
          import('./modules/upcoming-transactions/upcoming-transactions.component').then(m => m.UpcomingTransactionsComponent),
      },
    ],
  },
  // Ruta para no encontradas
  {
    path: '**',
    redirectTo: 'login',
  },
];
