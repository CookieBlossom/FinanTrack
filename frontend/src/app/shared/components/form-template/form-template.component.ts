import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-form-template',
  template: `
    <div class="form-container">
      <div class="form-section">
        <div class="form-header">
          <button class="close-button" (click)="onClose.emit()">
            <span class="close-icon">×</span>
          </button>
          <h3>{{ title }}</h3>
        </div>
        
        <div class="form-body">
          <ng-content></ng-content>
        </div>
        
        <div class="form-footer"></div>
      </div>

      <!-- Sección de información a la derecha -->
      <div class="info-section">
        <div class="info-content">
          <div class="info-icon">{{ icon }}</div>
          <h1 class="info-title">{{ infoTitle }}</h1>
          <p class="info-description">{{ description }}</p>
          <div class="info-features">
            <div class="feature" *ngFor="let feature of features">
              <span class="feature-icon">{{ feature.icon }}</span>
              <span class="feature-text">{{ feature.text }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    /* Contenedor principal */
    .form-container {
      height: 100dvh;
      width: 100dvw;
      display: flex;
      background-color: var(--color-primary-darker);
      justify-content: center;
      align-items: center;
      gap: 0;
      position: fixed;
      top: 0;
      left: 0;
      z-index: 1000;
    }

    /* Sección del formulario (50% izquierda) */
    .form-section {
      height: 95dvh;
      width: 50dvw;
      background-color: var(--clr-surface-a10);
      border-radius: 10px 0 0 10px;
      box-shadow: 0 0 10px 0 var(--clr-surface-a30);
      display: grid;
      grid-template-rows: auto 1fr auto;
    }

    /* Header del formulario */
    .form-header {
      display: flex;
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--clr-surface-a20);
      padding: 1rem 1.5rem;
    }

    .form-header h3 {
      font-size: var(--font-size-lg);
      color: var(--color-primary);
      margin: 0;
      text-align: center;
      flex: 1;
    }

    .close-button {
      background: var(--color-primary);
      color: var(--color-text-inverse);
      border: none;
      border-radius: 50%;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background-color 0.3s ease;
      font-size: var(--font-size-lg);
      font-weight: bold;
    }

    .close-button:hover {
      background: var(--color-primary-dark);
    }

    .close-icon {
      line-height: 1;
    }

    /* Body del formulario */
    .form-body {
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      overflow-y: auto;
    }

    /* Footer del formulario */
    .form-footer {
      padding: 1rem 1.5rem;
      border-top: 1px solid var(--clr-surface-a20);
    }

    /* Sección de información (50% derecha) */
    .info-section {
      height: 95dvh;
      width: 50dvw;
      background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-darkest) 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 0 10px 10px 0;
    }

    .info-content {
      text-align: center;
      color: var(--color-text-inverse);
      max-width: 400px;
      padding: 2rem;
    }

    .info-icon {
      font-size: 4rem;
      margin-bottom: 1.5rem;
    }

    .info-title {
      font-size: var(--font-size-xxl);
      font-weight: 700;
      margin: 0 0 1rem 0;
      letter-spacing: 2px;
    }

    .info-description {
      font-size: var(--font-size-md);
      margin: 0 0 2rem 0;
      opacity: 0.9;
      line-height: 1.5;
    }

    .info-features {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .feature {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-size: var(--font-size-sm);
    }

    .feature-icon {
      font-size: 1.2rem;
      width: 24px;
      text-align: center;
    }

    .feature-text {
      font-weight: 500;
    }

    /* Responsive */
    @media (max-width: 1024px) {
      .form-section {
        width: 60dvw;
      }
      
      .info-section {
        width: 40dvw;
      }
      
      .info-title {
        font-size: var(--font-size-xl);
      }
      
      .info-description {
        font-size: var(--font-size-sm);
      }
    }

    @media (max-width: 768px) {
      .form-container {
        flex-direction: column;
      }
      
      .form-section {
        width: 100dvw;
        height: 60dvh;
        border-radius: 10px 10px 0 0;
      }
      
      .info-section {
        width: 100dvw;
        height: 40dvh;
        border-radius: 0 0 10px 10px;
      }
      
      .info-content {
        padding: 1rem;
      }
      
      .info-icon {
        font-size: 3rem;
        margin-bottom: 1rem;
      }
      
      .info-title {
        font-size: var(--font-size-lg);
      }
      
      .info-description {
        font-size: var(--font-size-xs);
        margin-bottom: 1rem;
      }
      
      .info-features {
        gap: 0.5rem;
      }
      
      .feature {
        font-size: var(--font-size-xs);
      }
      
      .form-body {
        padding: 1rem;
      }
      
      .form-header {
        padding: 0.75rem 1rem;
      }
    }

    @media (max-width: 480px) {
      .form-section {
        height: 70dvh;
      }
      
      .info-section {
        height: 30dvh;
      }
      
      .info-features {
        display: none;
      }
      
      .form-body {
        padding: 0.75rem;
      }
    }
  `],
  standalone: true,
  imports: [CommonModule]
})
export class FormTemplateComponent {
  @Input() title: string = '';
  @Input() icon: string = '📝';
  @Input() infoTitle: string = '';
  @Input() description: string = '';
  @Input() features: Array<{icon: string, text: string}> = [];
  
  @Output() onClose = new EventEmitter<void>();
} 