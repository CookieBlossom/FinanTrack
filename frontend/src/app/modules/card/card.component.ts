import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgxChartsModule } from '@swimlane/ngx-charts';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
@Component({
  selector: 'app-card',
  templateUrl: './card.component.html',
  styleUrl: './card.component.css',
  imports: [CommonModule, NgxChartsModule, FormsModule, MatSlideToggleModule],
})
export class CardComponent {
  mostrarIngresos = true;

categoriasGasto = [
  { name: 'Alimentación', value: 250000 },
  { name: 'Transporte', value: 120000 },
  { name: 'Salud', value: 80000 },
  { name: 'Educación', value: 60000 },
];

dataIngresos = [
  {
    name: 'Esperado',
    series: [
      { name: 'Ene', value: 300000 },
      { name: 'Feb', value: 310000 },
      { name: 'Mar', value: 320000 },
    ]
  },
  {
    name: 'Real',
    series: [
      { name: 'Ene', value: 280000 },
      { name: 'Feb', value: 295000 },
      { name: 'Mar', value: 305000 },
    ]
  }
];

dataCostos = [
  {
    name: 'Esperado',
    series: [
      { name: 'Ene', value: 200000 },
      { name: 'Feb', value: 220000 },
      { name: 'Mar', value: 240000 },
    ]
  },
  {
    name: 'Real',
    series: [
      { name: 'Ene', value: 210000 },
      { name: 'Feb', value: 215000 },
      { name: 'Mar', value: 250000 },
    ]
  }
];
  tarjetas = [
    { saldo: 10000, activa: true },
    { saldo: 20000, activa: true },
    { saldo: 30000, activa: true },
    { saldo: 40000, activa: false },
    { saldo: 50000, activa: true },
  ];
  
  visibleStartIndex = 0;
  visibleCardCount = 3;
  
  get tarjetasVisibles() {
    return this.tarjetas.slice(this.visibleStartIndex, this.visibleStartIndex + this.visibleCardCount);
  }
  
  agregarTarjeta() {
    this.tarjetas.push({ saldo: 0, activa: true });
  }
  
}
