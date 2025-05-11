

import { Component, Inject,ChangeDetectionStrategy } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { DialogAnimationsExampleDialog } from './DialogAnimationsExampleDialog.component';
@Component({
  selector: 'app-dialog',
  imports: [MatButtonModule, MatDialogActions,  MatDialogClose, MatDialogTitle, MatDialogContent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dialog.component.html',
  styleUrl: './dialog.component.css'
})
export class DialogComponent {
  constructor(private dialogRef:MatDialogRef<DialogComponent>, private dialog: MatDialog, @Inject(MAT_DIALOG_DATA) public data: {exito:boolean}){}
 

  openDialog(enterAnimationDuration: string, exitAnimationDuration: string): void {
    const dialogRef = this.dialog.open(DialogAnimationsExampleDialog, {
      width: '250px',
      enterAnimationDuration,
      exitAnimationDuration,
    });

  
  }

  mostrar:boolean = false;

  enviarSolicitud(){
   this.dialogRef.close();
   this.dialog.open(DialogComponent,{
    width:'300px',
    data: {exito:true}
   })
    
  }

  cerrarDialogo(){
    this.mostrar = false;
  }
 

  

}









