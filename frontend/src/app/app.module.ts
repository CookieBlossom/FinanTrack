import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { AppComponent } from './app.component';
import { HttpClientModule } from '@angular/common/http';

@NgModule({
  declarations: [
    AppComponent // Declaración del componente principal
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    RouterModule.forRoot([{ path: 'dashboard', loadChildren: () => import('./modules/dashboard/dashboard.module').then(m => m.DashboardModule) }, { path: 'dashboard', loadChildren: () => import('./modules/login/login.module').then(m => m.LoginModule) }, { path: 'login', loadChildren: () => import('./modules/login/login.module').then(m => m.LoginModule) }, { path: 'register', loadChildren: () => import('./modules/register/register.module').then(m => m.RegisterModule) }, { path: 'profile', loadChildren: () => import('./modules/profile/profile.module').then(m => m.ProfileModule) }, { path: 'card', loadChildren: () => import('./modules/card/card.module').then(m => m.CardModule) }, { path: 'analytics', loadChildren: () => import('./modules/analytics/analytics.module').then(m => m.AnalyticsModule) }]) // Configuración de rutas vacía por ahora
  ],
  providers: [],
  bootstrap: [AppComponent] // Componente raíz que inicia la app
})
export class AppModule { }
