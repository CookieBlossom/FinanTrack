import { Routes } from '@angular/router';
import { LayoutComponent } from './shared/components/layout/layout.component';

// Esto carga todo lo que usa layout: dashboard, profile, etc.
export const routes: Routes = [
  // Rutas públicas (sin layout)
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
    path:'reset-pasword',
    loadComponent:() =>
      import('./modules/reset-pasword/reset-pasword.component').then(m => m.ResetPaswordComponent),
  },
  {
    path:'new-password',
    loadComponent:()=>
      import('./modules/new-password/new-password.component').then(m => m.NewPasswordComponent),

  },
  {
    path:'send-mail',
    loadComponent:() =>
      import('./modules/send-mail/send-mail.component').then(m => m.SendMailComponent),
  },
  

  // Rutas privadas (con layout u otra propiedad)
  {
    path: '',
    loadComponent: () =>
      import('./shared/components/layout/layout.component').then(m => m.LayoutComponent),
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./modules/dashboard/dashboard.component').then(m => m.DashboardComponent),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./modules/profile/profile.component').then(m => m.ProfileComponent),
      },
      {
        path: 'card',
        loadComponent: () =>
          import('./modules/card/card.component').then(m => m.CardComponent),
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
        path:'condicones',
        loadComponent:() =>
          import('./modules/condicones/condicones.component').then(m=>m.CondiconesComponent),
      },
      {
        path:'help',
        loadComponent:()=>
          import('./modules/help/help.component').then(m =>m.HelpComponent),
      },
      {
        path: 'subscriptions',
        loadComponent: () =>
          import('./modules/subscriptions/subscriptions.component').then(m => m.SubscriptionsComponent),
      },
      {
        path: 'upcoming-transactions',
        loadComponent: () =>
          import('./modules/upcoming-transactions/upcoming-transactions.component').then(m => m.UpcomingTransactionsComponent),
      },
      
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
    ],

  },
  // Ruta para no encontradas
  {
    path: '**',
    redirectTo: 'login',
  },
];
