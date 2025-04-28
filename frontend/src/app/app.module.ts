import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { AppComponent } from './app.component';
import { HttpClientModule } from '@angular/common/http';
import { routes } from './app.routes';
import {MatIconModule} from '@angular/material/icon';
import { ProfileComponent } from './modules/profile/profile.component';

@NgModule({
  declarations: [
    AppComponent, // Declaración del componente principal
    ProfileComponent
  ],
  imports: [
    MatIconModule,
    BrowserModule,
    HttpClientModule,
    RouterModule.forRoot(routes) ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
