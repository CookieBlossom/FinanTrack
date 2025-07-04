import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ScraperDialogComponent } from './scraper-dialog.component';

@Component({
  selector: 'app-scraper-example',
  template: `
    <div class="scraper-example">
      <h3>Scraper Automático</h3>
      <p>Conecta automáticamente con tu cuenta bancaria para importar movimientos.</p>
      
      <button 
        mat-raised-button 
        color="primary" 
        (click)="openScraperDialog()"
        class="scraper-button">
        <mat-icon>sync</mat-icon>
        Sincronizar con Banco Estado
      </button>
      
      <div class="info-section">
        <mat-icon color="accent">info</mat-icon>
        <div class="info-text">
          <strong>¿Cómo funciona?</strong>
          <ul>
            <li>Ingresa tus credenciales del banco</li>
            <li>El sistema se conecta automáticamente</li>
            <li>Importa tus cuentas y movimientos</li>
            <li>Los datos se sincronizan con tu perfil</li>
          </ul>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .scraper-example {
      padding: 20px;
      max-width: 600px;
      margin: 0 auto;
    }

    .scraper-button {
      margin: 20px 0;
      padding: 12px 24px;
      font-size: 16px;
    }

    .info-section {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      margin-top: 24px;
      padding: 16px;
      background-color: #f8f9fa;
      border-radius: 8px;
      border-left: 4px solid #007bff;
    }

    .info-text {
      flex: 1;
    }

    .info-text strong {
      display: block;
      margin-bottom: 8px;
      color: #333;
    }

    .info-text ul {
      margin: 0;
      padding-left: 20px;
    }

    .info-text li {
      margin-bottom: 4px;
      color: #666;
    }

    h3 {
      color: #333;
      margin-bottom: 8px;
    }

    p {
      color: #666;
      margin-bottom: 16px;
    }
  `]
})
export class ScraperExampleComponent {

  constructor(private dialog: MatDialog) {}

  openScraperDialog(): void {
    const dialogRef = this.dialog.open(ScraperDialogComponent, {
      width: '600px',
      maxHeight: '80vh',
      disableClose: true,
      panelClass: 'scraper-dialog-panel'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        console.log('Scraper dialog cerrado con resultado:', result);
        // Aquí puedes manejar el resultado si es necesario
        // Por ejemplo, recargar datos o mostrar una notificación
      }
    });
  }
}

// Ejemplo de uso en otro componente:
/*
import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ScraperDialogComponent } from './scraper/scraper-dialog.component';

@Component({
  selector: 'app-my-component',
  template: `
    <button mat-button (click)="openScraper()">
      <mat-icon>sync</mat-icon>
      Scraper
    </button>
  `
})
export class MyComponent {
  constructor(private dialog: MatDialog) {}

  openScraper() {
    this.dialog.open(ScraperDialogComponent, {
      width: '600px',
      disableClose: true
    });
  }
}
*/ 