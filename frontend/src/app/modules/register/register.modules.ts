import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent {

  nombre: string = "";
  email: string = "";
  telefono: string = "";
  password: string = "";
  passwordConf :string = "";

  GuardarDatos( ){
    console.log('Guardando datos')
    if(!this.nombre || !this.email || !this.telefono || !this.password ||!this.passwordConf){
      alert('Porfavor complete todos los campos')
      return
    }
  
  }
}

