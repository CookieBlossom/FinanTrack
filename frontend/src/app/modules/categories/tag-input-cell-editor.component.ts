import { Component } from '@angular/core';
import { ICellEditorAngularComp } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TagInputModule } from 'ngx-chips';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { PlanLimitsService } from '../../services/plan-limits.service';
import { PLAN_LIMITS } from '../../models/plan.model';

@Component({
  selector: 'tag-input-cell-editor',
  template: `
    <div class="tag-input-container">
      <tag-input
        [(ngModel)]="tags"
        [placeholder]="'Agregar keyword...'"
        [secondaryPlaceholder]="'Presiona enter o coma'"
        [maxItems]="maxKeywords"
        [addOnBlur]="true"
        [trimTags]="true"
        [separatorKeyCodes]="[13,188]"
        [theme]="'minimal'"
        (onAdd)="onTagAdded($event)"
        (onRemove)="onTagRemoved($event)">
      </tag-input>
      
      <!-- Mensaje de límite alcanzado -->
      <div *ngIf="showLimitMessage" class="limit-message">
        <mat-icon>warning</mat-icon>
        <span>Límite de {{ getFormattedMaxKeywords() }} keywords alcanzado</span>
        <button mat-button color="primary" (click)="upgradePlan()">Actualizar Plan</button>
      </div>
      
          <!-- Contador de keywords -->
    <div class="keyword-counter">
      {{ tags.length }}/{{ getFormattedMaxKeywords() }} keywords
    </div>
    </div>
  `,
  styles: [`
    .tag-input-container {
      position: relative;
      width: 100%;
      min-height: 60px;
      padding: 8px;
      background: var(--clr-surface-a0);
      border-radius: 8px;
      border: 1px solid var(--clr-surface-a20);
    }

    ::ng-deep tag-input {
      min-height: 40px !important;
      max-height: 200px !important;
      font-size: 13px;
      padding: 6px 8px !important;
      background: transparent !important;
      box-shadow: none !important;
      border: none !important;
      border-radius: 0 !important;
      width: 100% !important;
    }

    ::ng-deep tag-input .ng2-tags-container {
      display: flex;
      align-items: flex-start;
      flex-wrap: wrap;
      gap: 6px;
      padding: 4px 0;
      min-height: 28px;
      width: 100%;
    }

    ::ng-deep tag-input .ng2-tag {
      background: var(--color-primary) !important;
      color: var(--color-text-inverse) !important;
      border-radius: 16px !important;
      padding: 4px 10px !important;
      font-size: 12px !important;
      height: 24px !important;
      display: flex !important;
      align-items: center !important;
      margin: 0 !important;
      border: 1px solid var(--color-primary-darkest) !important;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2) !important;
      transition: all 0.2s ease !important;
      position: relative !important;
      overflow: hidden !important;
    }

    ::ng-deep tag-input .ng2-tag::before {
      content: '' !important;
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%) !important;
      pointer-events: none !important;
    }

    ::ng-deep tag-input .ng2-tag:hover {
      background: var(--color-primary-darkest) !important;
      transform: translateY(-1px) !important;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3) !important;
    }

    ::ng-deep tag-input .ng2-tag .ng2-tag__remove-button {
      color: var(--color-text-inverse) !important;
      font-size: 14px !important;
      margin-left: 6px !important;
      opacity: 0.8 !important;
      background: none !important;
      border: none !important;
      padding: 0 !important;
      cursor: pointer !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: 16px !important;
      height: 16px !important;
      border-radius: 50% !important;
      transition: all 0.2s ease !important;
    }

    ::ng-deep tag-input .ng2-tag .ng2-tag__remove-button:hover {
      opacity: 1 !important;
      background: rgba(255, 255, 255, 0.2) !important;
    }

    ::ng-deep tag-input input {
      background: transparent !important;
      color: var(--color-text) !important;
      border: none !important;
      outline: none !important;
      font-size: 13px !important;
      padding: 4px 6px !important;
      min-width: 80px !important;
      height: 24px !important;
      margin: 2px 0 !important;
      border-radius: 4px !important;
      transition: all 0.2s ease !important;
    }

    ::ng-deep tag-input input:focus {
      background: rgba(168, 79, 104, 0.1) !important;
      box-shadow: 0 0 0 2px rgba(168, 79, 104, 0.2) !important;
    }

    ::ng-deep tag-input input::placeholder {
      color: var(--color-text-muted) !important;
      font-style: italic !important;
    }

    .limit-message {
      display: flex;
      align-items: center;
      gap: 6px;
      background: rgba(255, 193, 7, 0.1);
      border: 1px solid rgba(255, 193, 7, 0.3);
      border-radius: 6px;
      padding: 6px 10px;
      margin-top: 6px;
      font-size: 11px;
      color: #ffc107;
    }

    .limit-message mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    .limit-message button {
      font-size: 10px;
      padding: 2px 8px;
      min-width: auto;
      line-height: 1;
      background: var(--color-primary);
      color: var(--color-text-inverse);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .limit-message button:hover {
      background: var(--color-primary-darkest);
    }

    .keyword-counter {
      position: absolute;
      top: -8px;
      right: 12px;
      background: var(--clr-surface-a0);
      border: 1px solid var(--clr-surface-a20);
      border-radius: 10px;
      padding: 2px 8px;
      font-size: 10px;
      color: var(--color-text-secondary);
      z-index: 10;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
  `],
  standalone: true,
  imports: [CommonModule, FormsModule, TagInputModule, MatIconModule, MatButtonModule]
})
export class TagInputCellEditorComponent implements ICellEditorAngularComp {
  tags: string[] = [];
  maxKeywords: number = 10;
  showLimitMessage: boolean = false;
  readonly UNLIMITED_KEYWORDS = Number.MAX_SAFE_INTEGER;
  
  constructor(private planLimitsService: PlanLimitsService) {}

  agInit(params: any): void {
    if (Array.isArray(params.value)) {
      // Convierte objetos a string si llegan así
      this.tags = params.value
        .map((k: any) => {
          if (typeof k === 'string') {
            return k.trim();
          } else if (k && typeof k === 'object') {
            // Si es un objeto con display y value, usa display
            const value = k.display || k.value || '';
            return typeof value === 'string' ? value.trim() : String(value).trim();
          } else if (k != null) {
            return String(k).trim();
          }
          return '';
        })
        .filter((tag: string) => tag && tag.length > 0); // Filtra valores vacíos
    } else if (typeof params.value === 'string') {
      this.tags = params.value.split(',').map((s: string) => s.trim()).filter(Boolean);
    } else {
      this.tags = [];
    }
    this.loadKeywordLimit();
  }

  private loadKeywordLimit(): void {
    this.planLimitsService.getLimitStatusInfo(PLAN_LIMITS.KEYWORDS_PER_CATEGORY).subscribe({
      next: (limitStatus) => {
        console.log('[TagInputEditor] Límite cargado:', limitStatus);
        if (limitStatus.limit === -1) {
          this.maxKeywords = this.UNLIMITED_KEYWORDS; // Prácticamente ilimitado
          console.log('[TagInputEditor] Plan ilimitado detectado');
        } else {
          this.maxKeywords = limitStatus.limit;
          console.log('[TagInputEditor] Límite establecido en:', this.maxKeywords);
        }
        this.updateLimitMessage();
      },
      error: (error) => {
        console.error('[TagInputEditor] Error al cargar límite de keywords:', error);
        this.maxKeywords = Math.max(this.tags.length + 5, 10);
        console.log('[TagInputEditor] Límite de emergencia establecido en:', this.maxKeywords);
      }
    });
  }

  private updateLimitMessage(): void {
    this.showLimitMessage = this.maxKeywords !== this.UNLIMITED_KEYWORDS && this.tags.length >= this.maxKeywords;
  }

  onTagAdded(event: any): void {
    this.updateLimitMessage();
  }

  onTagRemoved(event: any): void {
    this.updateLimitMessage();
  }

  upgradePlan(): void {
  }

  /**
   * Formatea el límite máximo de keywords para mostrar texto amigable
   */
  getFormattedMaxKeywords(): string {
    if (this.maxKeywords === this.UNLIMITED_KEYWORDS || this.maxKeywords === -1) {
      return '∞';
    }
    return this.maxKeywords.toString();
  }

  getValue(): any {
    return this.tags
      .map(tag => {
        if (typeof tag === 'string') return tag.trim();
        if (typeof tag === 'object' && tag !== null) {
          const tagObj = tag as any;
          return (tagObj.value || tagObj.display || '').trim();
        }
        return '';
      })
      .filter(tag => tag.length > 0);
  }

  isPopup?(): boolean {
    return true;
  }
}