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
        <span>Límite de {{ maxKeywords }} keywords alcanzado</span>
        <button mat-button color="primary" (click)="upgradePlan()">Actualizar Plan</button>
      </div>
      
      <!-- Contador de keywords -->
      <div class="keyword-counter">
        {{ tags.length }}/{{ maxKeywords }} keywords
      </div>
    </div>
  `,
  styles: [`
    .tag-input-container {
      position: relative;
    }

    ::ng-deep tag-input {
      min-height: 32px !important;
      max-height: 34px !important;
      font-size: 13px;
      padding: 0 6px;
      background: transparent !important;
      box-shadow: none !important;
      border: none !important;
    }

    ::ng-deep tag-input .ng2-tags-container {
      display: flex;
      align-items: center;
      flex-wrap: nowrap;
      overflow-x: auto;
      max-width: 220px;
      height: 32px;
      gap: 3px;
      padding: 0;
    }

    ::ng-deep tag-input .ng2-tag {
      background: #e3e3e3;
      border-radius: 12px;
      padding: 1px 8px;
      font-size: 13px;
      height: 22px;
      display: flex;
      align-items: center;
      margin: 0 2px;
    }

    .limit-message {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #fff3cd;
      border: 1px solid #ffeaa7;
      border-radius: 4px;
      padding: 4px 8px;
      margin-top: 4px;
      font-size: 11px;
      color: #856404;
    }

    .limit-message mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    .limit-message button {
      font-size: 10px;
      padding: 2px 6px;
      min-width: auto;
      line-height: 1;
    }

    .keyword-counter {
      position: absolute;
      top: -8px;
      right: 8px;
      background: #f8f9fa;
      border: 1px solid #e9ecef;
      border-radius: 10px;
      padding: 1px 6px;
      font-size: 10px;
      color: #6c757d;
    }
  `],
  standalone: true,
  imports: [CommonModule, FormsModule, TagInputModule, MatIconModule, MatButtonModule]
})
export class TagInputCellEditorComponent implements ICellEditorAngularComp {
  tags: string[] = [];
  maxKeywords: number = 10;
  showLimitMessage: boolean = false;
  
  constructor(private planLimitsService: PlanLimitsService) {}

  agInit(params: any): void {
    if (Array.isArray(params.value)) {
      // Convierte objetos a string si llegan así.
      this.tags = params.value.map((k: any) => typeof k === 'string' ? k : (k.value ?? ''));
    } else if (typeof params.value === 'string') {
      this.tags = params.value.split(',').map((s: string) => s.trim()).filter(Boolean);
    } else {
      this.tags = [];
    }

    // Obtener límite de keywords del plan actual
    this.loadKeywordLimit();
  }

  private loadKeywordLimit(): void {
    this.planLimitsService.getLimitStatusInfo(PLAN_LIMITS.KEYWORDS_PER_CATEGORY).subscribe({
      next: (limitStatus) => {
        this.maxKeywords = limitStatus.limit;
        this.updateLimitMessage();
      },
      error: (error) => {
        console.error('Error al cargar límite de keywords:', error);
        this.maxKeywords = 5; // Límite por defecto
      }
    });
  }

  private updateLimitMessage(): void {
    this.showLimitMessage = this.tags.length >= this.maxKeywords;
  }

  onTagAdded(event: any): void {
    this.updateLimitMessage();
  }

  onTagRemoved(event: any): void {
    this.updateLimitMessage();
  }

  upgradePlan(): void {
    window.location.href = '/plans';
  }

  getValue(): any {
    // Siempre devuelve array de strings
    return this.tags;
  }

  isPopup?(): boolean {
    return true;
  }
}