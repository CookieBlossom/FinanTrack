

import { Component } from '@angular/core';
import {
    MatDialog,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatDialogRef,
    MatDialogTitle,
  } from '@angular/material/dialog';
  import { MatIconModule } from '@angular/material/icon';
  import { MatIcon } from '@angular/material/icon';
import { DialogExampleDialog } from './dialog.component';



@Component({
  selector: 'dialog',
  standalone: true,
  imports: [MatIconModule,MatIcon, MatDialogActions,MatDialogClose,
    MatDialogContent,
    MatDialogTitle,],
  templateUrl: './dialog.component.html',
  styleUrls: ['./dialog.component.scss']
})
export class DialogComponent{
  constructor( private dialogRef:MatDialogRef<DialogComponent>, private dialog: MatDialog ){}

  confirmar(){
    this.dialogRef.close();
    this.dialog.open(DialogExampleDialog,{
      width:'300px'

    })
  }

}