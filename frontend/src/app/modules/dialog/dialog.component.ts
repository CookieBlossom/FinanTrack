

import { Component, Inject,ChangeDetectionStrategy } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
@Component({
  selector: 'app-dialog',
  imports: [MatButtonModule, MatDialogActions, MatDialogContent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dialog.component.html',
  styleUrl: './dialog.component.css'
})
export class DialogComponent {
  constructor(private dialogRef:MatDialogRef<DialogComponent>, private dialog: MatDialog, @Inject(MAT_DIALOG_DATA) public data: {exito:boolean}){}
 

  confirmar(){
    this.dialogRef.close();
    this.dialog.open(DialogExampleDialog,{
      width:'300px'

    })
  }



  
  


 

  

}

@Component({
  selector: 'dialog-example-dialog',
  imports: [MatButtonModule, MatDialogActions, MatDialogContent],
  template: ` 
  <h2 mat-dialog-title>Éxito</h2>
  <mat-dialog-content>Su solicitud se ha enviado con éxito</mat-dialog-content>
  <mat-dialog-actions align="end">
    <button mat-button mat-dialog-close>Aceptar</button>
  </mat-dialog-actions>
`,
  
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogExampleDialog {
  
}









