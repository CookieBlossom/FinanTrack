import { Component } from '@angular/core';

@Component({
  selector: 'app-billing-placeholder',
  template: `
    <div class="billing-placeholder">
      <div class="placeholder-content">
        <div class="placeholder-icon">💳</div>
        <h3>Gestión de Facturación</h3>
        <p>Esta funcionalidad estará disponible próximamente.</p>
        <div class="placeholder-features">
          <div class="feature">
            <span class="feature-icon">🔄</span>
            <span>Cambiar plan de suscripción</span>
          </div>
          <div class="feature">
            <span class="feature-icon">📄</span>
            <span>Ver historial de facturas</span>
          </div>
          <div class="feature">
            <span class="feature-icon">💳</span>
            <span>Gestionar métodos de pago</span>
          </div>
          <div class="feature">
            <span class="feature-icon">⚙️</span>
            <span>Configurar facturación automática</span>
          </div>
        </div>
        <button class="placeholder-button" (click)="close()">
          Entendido
        </button>
      </div>
    </div>
  `,
  styles: [`
    .billing-placeholder {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 400px;
      padding: 2rem;
    }

    .placeholder-content {
      text-align: center;
      max-width: 400px;
    }

    .placeholder-icon {
      font-size: 4rem;
      margin-bottom: 1rem;
    }

    h3 {
      color: #333;
      margin-bottom: 1rem;
      font-size: 1.5rem;
    }

    p {
      color: #666;
      margin-bottom: 2rem;
      line-height: 1.5;
    }

    .placeholder-features {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-bottom: 2rem;
    }

    .feature {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: #555;
      font-size: 0.9rem;
    }

    .feature-icon {
      font-size: 1.1rem;
    }

    .placeholder-button {
      background: #007bff;
      color: white;
      border: none;
      padding: 0.75rem 2rem;
      border-radius: 6px;
      font-size: 0.9rem;
      cursor: pointer;
      transition: background 0.2s ease;
    }

    .placeholder-button:hover {
      background: #0056b3;
    }
  `]
})
export class BillingPlaceholderComponent {
  close() {
    // Implementar cierre del modal/dialog
    console.log('Cerrar placeholder de facturación');
  }
} 