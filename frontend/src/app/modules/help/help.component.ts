import { Component, inject,ChangeDetectionStrategy } from '@angular/core';
import {MatInputModule} from '@angular/material/input';
import {MatFormFieldModule} from '@angular/material/form-field';
import {FormsModule} from '@angular/forms';
import {MatSelectModule} from '@angular/material/select';
import { DialogAnimationsExampleDialog } from '../dialog/DialogAnimationsExampleDialog.component';
interface Opcion{
  value:string
}
import {
  MatDialog,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { DialogComponent } from '../dialog/dialog.component';

@Component({
  selector: 'app-help',
  standalone:true,
  imports: [MatInputModule,DialogComponent, MatFormFieldModule, FormsModule,MatSelectModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './help.component.html',
  styleUrl: './help.component.css'
})
export class HelpComponent {

  opcion: Opcion [] =[
    {
      value:'Problemas al eliminar/agregar tarjeta'
    },
    {
      value:'Saldo de la tarjeta no esta actualizado'
    },
    {value:'Otro'},
  ];

  readonly dialog = inject(MatDialog);

  openDialog(enterAnimationDuration: string, exitAnimationDuration: string): void {
     this.dialog.open(DialogAnimationsExampleDialog, {
      width: '250px',
      enterAnimationDuration,
      exitAnimationDuration,
    });
  }


  

  

  
}

