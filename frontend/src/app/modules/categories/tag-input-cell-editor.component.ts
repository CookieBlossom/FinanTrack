import { Component } from '@angular/core';
import { ICellEditorAngularComp } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TagInputModule } from 'ngx-chips';

@Component({
  selector: 'tag-input-cell-editor',
  template: `
    <tag-input
    [(ngModel)]="tags"
    [placeholder]="'Agregar keyword...'"
    [secondaryPlaceholder]="'Presiona enter o coma'"
    [maxItems]="10"
    [addOnBlur]="true"
    [trimTags]="true"
    [separatorKeyCodes]="[13,188]"
    [theme]="'minimal'">
    </tag-input>
  `,
  styles: [`
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
  `],
  standalone: true,
  imports: [CommonModule, FormsModule, TagInputModule]
})
export class TagInputCellEditorComponent implements ICellEditorAngularComp {
    tags: string[] = [];
  
    agInit(params: any): void {
        if (Array.isArray(params.value)) {
          // Convierte objetos a string si llegan así.
          this.tags = params.value.map((k: any) => typeof k === 'string' ? k : (k.value ?? ''));
        } else if (typeof params.value === 'string') {
          this.tags = params.value.split(',').map((s: string) => s.trim()).filter(Boolean);
        } else {
          this.tags = [];
        }
    }
  
    getValue(): any {
      // Siempre devuelve array de strings
      return this.tags;
    }
  
    isPopup?(): boolean {
      return true;
    }
  }