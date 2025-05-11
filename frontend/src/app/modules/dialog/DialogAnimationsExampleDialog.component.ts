
import { MatDialog, MatDialogActions, MatDialogClose,
    MatDialogTitle,MatDialogContent, MatDialogRef
 } from "@angular/material/dialog";

 import { Component, inject,ChangeDetectionStrategy } from '@angular/core';
 import { MatButtonModule } from "@angular/material/button";


@Component({
    selector: 'dialog-animations-example-dialog',
    templateUrl: 'dialog.component.html',
    imports: [MatButtonModule, MatDialogActions, MatDialogClose, MatDialogTitle, MatDialogContent],
    changeDetection: ChangeDetectionStrategy.OnPush,
  })
  export class DialogAnimationsExampleDialog {
    readonly dialogRef = inject(MatDialogRef<DialogAnimationsExampleDialog>);
  
  
    mostrar:boolean = false;
  
    enviarSolicitud(){
      this.mostrar = true;
    }
  
    cerrarDialogo(){
      this.mostrar = false;
    }
   
    
  
  }