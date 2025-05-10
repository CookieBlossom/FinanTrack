import { Component } from '@angular/core';
import {MatInputModule} from '@angular/material/input';
import {MatFormFieldModule} from '@angular/material/form-field';
import {FormsModule} from '@angular/forms';
import {MatSelectModule} from '@angular/material/select';
interface Opcion{
  value:string
}

@Component({
  selector: 'app-help',
  imports: [MatInputModule, MatFormFieldModule, FormsModule,MatSelectModule],
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

}
