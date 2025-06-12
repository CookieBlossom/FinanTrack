import { bootstrapApplication } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import '@angular/compiler';

bootstrapApplication(AppComponent, {
  ...appConfig,
  providers: [
    ...appConfig.providers ?? [],
    provideAnimations()
  ]
}).catch((err) => console.error(err));