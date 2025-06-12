import { Component } from '@angular/core';
import { ICellEditorAngularComp, ICellRendererAngularComp } from 'ag-grid-angular';
import { FormsModule } from '@angular/forms'; // IMPORTANTE

@Component({
  selector: 'app-color-picker-cell-editor',
  imports: [FormsModule],
  template: `
    <div class="color-editor">
      <input
        type="color"
        [value]="color"
        (input)="onColorChange($event)"
        style="width: 32px; height: 32px; border: none; background: transparent; cursor: pointer;"
        autofocus
      />
    </div>
  `,
  styles: [`
    .color-editor {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      background: transparent;
    }
  `]
})
export class ColorPickerCellRendererComponent implements ICellRendererAngularComp {
  private params: any;
  color: string = '#9E9E9E';

  agInit(params: any): void {
    this.params = params;
    this.color = params.value || '#9E9E9E';
  }

  refresh(params: any): boolean {
    this.color = params.value;
    return true;
  }

  onColorChange(event: any): void {
    this.color = event.target.value;
    // Actualiza el valor en la celda y en tu backend
    if (this.params && this.params.colDef && this.params.colDef.field && this.params.data) {
      this.params.data[this.params.colDef.field] = this.color;
      // Notifica a ag-Grid del cambio
      this.params.api.applyTransaction({ update: [this.params.data] });
      // Llama tu método para actualizar el backend aquí si quieres actualización inmediata:
      if (this.params.context && this.params.context.componentParent && this.params.context.componentParent.onColorChanged) {
        this.params.context.componentParent.onColorChanged(this.params.data.id, this.color);
      }
    }
  }
}