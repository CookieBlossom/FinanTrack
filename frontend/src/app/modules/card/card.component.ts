import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Card } from '../../models/card.model';
import { CardService } from '../../services/card.service';
import { AddCardDialogComponent } from './add-card-dialog/add-card-dialog.component';
import { firstValueFrom, Subject, Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { NgxChartsModule } from '@swimlane/ngx-charts';
import { EditCardDialogComponent } from './edit-card-dialog/edit-card-dialog.component';
import { DeleteCardDialogComponent } from './delete-card-dialog/delete-card-dialog.component';
import { FeatureControlDirective } from '../../shared/directives/feature-control.directive';
import { PlanLimitsService } from '../../services/plan-limits.service';
import { Router } from '@angular/router';

import { FeatureControlService } from '../../services/feature-control.service';

interface ChartDataItem {
  name: string;
  value: number;
  originalValue: number;
  cardName: string;
  fullName: string;
  formattedBalance: string;
}

@Component({
  selector: 'app-card',
  templateUrl: './card.component.html',
  styleUrls: ['./card.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    NgxChartsModule,
    FeatureControlDirective
  ],
  providers: [FeatureControlService]
})
export class CardComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('chartContainer') chartContainer!: ElementRef;
  cards: Card[] = [];
  error: string | null = null;
  totalBalance: number = 0;
  limitsInfo: any = null;
  loading = false;
  syncing = false;
  private destroy$ = new Subject<void>();

  // Configuración de colores para el gráfico
  colorScheme: any = {
    domain: [
      'var(--color-primary)',      // #a84f68
      'var(--color-accent)',       // #9b2949
      'var(--color-highlight)',    // #e69ac3
      'var(--color-primary-dark)', // #6d2237
      'var(--color-primary-darker)', // #4f0f20
      'var(--color-primary-darkest)', // #311019
      'var(--color-success)',      // #28a745
      'var(--color-info)'          // #17a2b8
    ]
  };

  // Tamaño responsive del gráfico
  chartView: [number, number] = [0, 0]; // Se calculará dinámicamente

  chartData: ChartDataItem[] = [];
  view: [number, number] = [700, 400];

  // 🔄 Datos reactivos - se inicializan en el constructor
  cards$!: Observable<Card[]>;
  loading$!: Observable<boolean>;
  
  // Estados de carga
  isDeleting = false;
  isSyncingAll = false;

  constructor(
    private cardService: CardService,
    private planLimitsService: PlanLimitsService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private hostRef: ElementRef,
    private router: Router,
    private changeDetectorRef: ChangeDetectorRef,
    private featureControlService: FeatureControlService
  ) {
    // 🔄 Inicializar observables reactivos
    this.cards$ = this.cardService.cards$;
    this.loading$ = this.cardService.loading$;
  }
  
  chartLabels: string[] = [];
  
  async ngOnInit(): Promise<void> {
    // 🔄 Cargar tarjetas usando el sistema reactivo
    this.cardService.getCards().subscribe();
    
    await this.loadInitialData();
    this.calculateChartSize();
    
    // Escuchar cambios de tamaño de ventana con debounce
    let resizeTimeout: any;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        this.calculateChartSize();
      }, 250);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    window.removeEventListener('resize', () => this.calculateChartSize());
  }

  // Método público para cargar datos iniciales y reintentar
  async loadInitialData(): Promise<void> {
    console.log('🔄 Iniciando carga de datos...');
    this.loading = true;
    this.error = null;
    this.changeDetectorRef.detectChanges();
    
    try {
      // 1. Primero cargar límites (no bloqueante)
      this.loadLimitsInfo();
      
      // 2. Luego cargar tarjetas y balance total
      await this.loadCardsAndBalance();
      console.log('✅ Datos cargados exitosamente');
      
    } catch (error) {
      console.error('❌ Error al cargar datos iniciales:', error);
      // Establecer error y asegurar que loading se resetee
      this.error = 'No se pudieron cargar las tarjetas';
      this.cards = [];
      this.totalBalance = 0;
    } finally {
      console.log('🏁 Finalizando carga, loading = false');
      this.loading = false;
      this.changeDetectorRef.detectChanges();
    }
  }
  
  private async loadLimitsInfo(): Promise<void> {
    try {
      // Suscribirse al observable de límites para recibir actualizaciones
      this.planLimitsService.currentUsage$.pipe(
        takeUntil(this.destroy$)
      ).subscribe({
        next: (usage) => {
          console.log('🔄 Límites actualizados:', usage);
          this.limitsInfo = usage;
        },
        error: (error) => {
          console.error('Error al cargar límites:', error);
        }
      });
    } catch (error) {
      console.error('Error al cargar información de límites:', error);
    }
  }
  private async loadCardsAndBalance(): Promise<void> {
    try {
      await this.loadCards();
      this.totalBalance = this.getTotalBalance();
    } catch (error) {
      console.error('Error al cargar tarjetas y balance:', error);
      this.cards = [];
      this.totalBalance = 0;
      throw error;
    }
  }
  private async loadCards(): Promise<void> {
    try {
      console.log('📞 Llamando al servicio de tarjetas...');
      this.cards = await firstValueFrom(this.cardService.getCards());
      console.log('📋 Tarjetas cargadas:', this.cards.length);
      this.updateChartData();
    } catch (error) {
      console.error('❌ Error al cargar tarjetas:', error);
      this.cards = [];
      throw error; // Re-lanzar para manejo en loadCardsAndBalance
    }
  }

  private async updateData(): Promise<void> {
    try {
      this.error = null;
      await this.loadCardsAndBalance();
      this.planLimitsService.refreshUsage();
      setTimeout(() => {
        this.calculateChartSize();
      }, 100);
      
    } catch (error) {
      console.error('Error al actualizar datos:', error);
      this.error = 'Error al actualizar los datos. Por favor, intenta nuevamente.';
      throw error; // Re-lanzar para manejo en los métodos que llaman a updateData
    }
  }
  
  get visibleCards(): Card[] {
    return this.cards.filter(card => card.nameAccount.toLowerCase() !== 'efectivo');
  }

  openAddCardDialog(): void {
    const dialogRef = this.dialog.open(AddCardDialogComponent, {
      width: 'min(800px, 90vw)',
      height: 'min(700px, 90vh)',
      maxWidth: '90vw',
      maxHeight: '90vh',
      panelClass: 'custom-dialog'
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        try {
          this.snackBar.open('Actualizando datos...', 'Cerrar', { duration: 2000 });
          await this.updateData();
          this.snackBar.open('Tarjeta agregada exitosamente', 'Cerrar', { duration: 3000 });
        } catch (error) {
          console.error('Error al actualizar después de agregar tarjeta:', error);
          this.snackBar.open('Tarjeta agregada pero hubo un problema al actualizar la vista. Recarga la página.', 'Cerrar', { duration: 5000 });
        }
      }
    });
  }
  
  getTotalBalance(): number {
    return this.cards
      .filter(card => card.statusAccount === 'active' && card.nameAccount.toLowerCase() !== 'efectivo')
      .reduce((total, card) => total + (card.balance || 0), 0);
  }
  
  getPieChartData() {
    // Filtrar tarjetas activas con saldo (positivo o negativo)
    const activeCards = this.cards.filter(card => 
      card.statusAccount === 'active' && 
      card.nameAccount.toLowerCase() !== 'efectivo'
    );
    
    // Si no hay tarjetas activas, retornar array vacío
    if (activeCards.length === 0) {
      console.log('📊 No hay tarjetas activas para mostrar en el gráfico');
      return [];
    }
    
    const chartData = activeCards.map(card => {
      let balance = 0;
      if (typeof card.balance === 'number' && !isNaN(card.balance)) {
        balance = card.balance;
        console.log('📊 Balance es número válido:', balance);
      } else if (typeof card.balance === 'string') {
        balance = parseFloat(card.balance) || 0;
        console.log('📊 Balance convertido de string:', balance);
      } else {
        console.log('📊 Balance no válido, usando 0');
        balance = 0;
      }
      
      const displayName = card.nameAccount;
      
      console.log(`📊 Tarjeta: ${displayName}, Balance final: ${balance}, Tipo: ${typeof balance}`);
      
      // Solo formatear si el balance es un número válido
      let formattedBalance = 'CLP 0';
      if (!isNaN(balance) && isFinite(balance)) {
        try {
          formattedBalance = new Intl.NumberFormat('es-CL', {
            style: 'currency',
            currency: 'CLP',
            minimumFractionDigits: 0
          }).format(balance);
          console.log('📊 Formato exitoso:', formattedBalance);
        } catch (error) {
          console.error('📊 Error al formatear:', error);
          formattedBalance = 'CLP 0';
        }
      } else {
        console.log('📊 Balance no válido para formateo, usando CLP 0');
      }
      
      // Usar nombre corto para la leyenda (sin el balance)
      const legendName = displayName.length > 15 ? displayName.substring(0, 15) + '...' : displayName;
      
      const result = {
        name: legendName, // Nombre corto para la leyenda
        value: Math.abs(balance), // Usar valor absoluto para el gráfico
        originalValue: balance, // Guardar el valor original para referencias
        cardName: displayName, // Nombre completo para tooltip
        fullName: `${displayName} (${formattedBalance})`, // Nombre completo con balance
        formattedBalance: formattedBalance // Balance formateado para tooltip
      };
      
      console.log(`📊 Resultado final para gráfico:`, result);
      return result;
    }).filter(item => item.value > 0); // Solo incluir tarjetas con saldo positivo para el gráfico
    
    console.log('📊 Datos finales del gráfico:', chartData);
    return chartData;
  }

  hasChartData(): boolean {
    const chartData = this.getPieChartData();
    return chartData.length > 0 && chartData.some(item => item.value > 0);
  }
  
  formatLabel(value: any): string {
    console.log('📊 formatLabel llamado con valor:', value, 'tipo:', typeof value);
    
    // Asegurar que el valor sea un número válido
    let numericValue = 0;
    if (typeof value === 'number' && !isNaN(value) && isFinite(value)) {
      numericValue = value;
    } else if (typeof value === 'string') {
      numericValue = parseFloat(value) || 0;
    } else {
      console.log('📊 Valor no válido en formatLabel, usando 0');
      numericValue = 0;
    }
    
    console.log('📊 Valor numérico para formateo:', numericValue);
    
    try {
      // Formatear el valor como moneda chilena
      const formatted = new Intl.NumberFormat('es-CL', {
        style: 'currency',
        currency: 'CLP',
        minimumFractionDigits: 0
      }).format(numericValue);
      
      console.log('📊 Resultado formateado:', formatted);
      return formatted;
    } catch (error) {
      console.error('📊 Error en formatLabel:', error);
      return 'CLP 0';
    }
  }

  formatTooltip = (value: any): string => {
    if (value && value.data) {
      const cardName = value.data.cardName || value.data.name;
      const amount = value.data.originalValue || value.data.value;
      const formattedAmount = value.data.formattedBalance || this.formatLabel(amount);
      
      // Calcular el porcentaje del total
      const totalBalance = this.getTotalBalance();
      const percentage = totalBalance > 0 ? ((Math.abs(amount) / totalBalance) * 100).toFixed(1) : '0';
      const totalFormatted = this.formatLabel(totalBalance);
      
      return `<div style="font-size: 12px; line-height: 1.4;">
        <strong>${cardName}</strong><br>
        ${formattedAmount} (${percentage}%)<br>
        <small>Total: ${totalFormatted}</small>
      </div>`;
    }
    return '';
  }
  
  async deleteCard(cardId: number, cardName?: string): Promise<void> {
    const dialogRef = this.dialog.open(DeleteCardDialogComponent, {
      width: '380px',
      data: { cardName }
    });
    const confirmed = await firstValueFrom(dialogRef.afterClosed());
  
    if (!confirmed) return;
  
    try {
      console.log('🗑️ Eliminando tarjeta:', cardId, cardName);
      this.snackBar.open('Eliminando tarjeta...', 'Cerrar', { duration: 2000 });
      await this.onCardDeleted(cardId);
    } catch (error) {
      console.error('Error al eliminar tarjeta:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error al eliminar la tarjeta';
      this.snackBar.open(errorMessage, 'Cerrar', { duration: 5000 });
    }
  }
  
  editCard(card: Card): void {
    const dialogRef = this.dialog.open(EditCardDialogComponent, {
      width: '400px',
      data: card
    });
    
    dialogRef.afterClosed().subscribe(async (updatedCard) => {
      if (updatedCard) {
        try {
          this.snackBar.open('Actualizando datos...', 'Cerrar', { duration: 2000 });
          await this.updateData();
          this.snackBar.open('Tarjeta actualizada exitosamente', 'Cerrar', { duration: 3000 });
        } catch (error) {
          console.error('Error al actualizar después de editar tarjeta:', error);
          this.snackBar.open('Tarjeta actualizada pero hubo un problema al actualizar la vista. Recarga la página.', 'Cerrar', { duration: 5000 });
        }
      }
    });
  }
  
  async syncCard(): Promise<void> {
    if (this.syncing) return;
    
    this.syncing = true;
    try {
      this.snackBar.open('Sincronizando tarjetas...', 'Cerrar', { duration: 2000 });
      await this.syncAllCards();
      this.snackBar.open('Tarjetas sincronizadas exitosamente', 'Cerrar', { duration: 3000 });
    } catch (error) {
      console.error('Error al sincronizar tarjetas:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error al sincronizar las tarjetas';
      this.snackBar.open(errorMessage, 'Cerrar', { duration: 5000 });
    } finally {
      this.syncing = false;
    }
  }

  getCardBalance(card: Card): number {
    return card.balance || 0;
  }

  hasCards(): boolean {
    return this.visibleCards.length > 0;
  }

  // Método para forzar recarga manual de datos
  async forceRefresh(): Promise<void> {
    try {
      this.snackBar.open('Recargando datos...', 'Cerrar', { duration: 2000 });
      // No mostrar loading durante recarga manual, solo actualizar datos
      await this.updateData();
      this.snackBar.open('Datos actualizados', 'Cerrar', { duration: 2000 });
    } catch (error) {
      console.error('Error al forzar recarga:', error);
      this.snackBar.open('Error al recargar datos', 'Cerrar', { duration: 3000 });
    }
  }

  // Método para limpiar errores y reintentar
  async retryLoad(): Promise<void> {
    this.error = null;
    await this.forceRefresh();
  }

  // Método para calcular el tamaño del gráfico según el contenedor
  calculateChartSize(): void {
    // Usar setTimeout para asegurar que el DOM esté actualizado
    setTimeout(() => {
      const chartContainer = document.querySelector('.chart-wrapper');
      if (chartContainer) {
        const rect = chartContainer.getBoundingClientRect();
        const containerWidth = rect.width;
        const containerHeight = rect.height;
        
        // Sin leyenda, usar casi todo el espacio disponible
        const width = Math.max(containerWidth - 20, 250); // Solo 10px de padding a cada lado
        const height = Math.max(containerHeight - 20, 250); // Solo 10px de padding arriba y abajo
        
        this.chartView = [width, height];
        console.log(`📏 Gráfico redimensionado a: ${width}x${height} (contenedor: ${containerWidth}x${containerHeight})`);
        this.changeDetectorRef.detectChanges();
      }
    }, 300); // Aumentar el timeout para asegurar que los elementos estén completamente renderizados
  }

  updateChartData() {
    if (!this.cards || this.cards.length === 0) {
      this.chartData = [];
      return;
    }

    this.chartData = this.cards
      .filter(card => card.statusAccount === 'active')
      .map(card => {
        const balance = card.balance;
        if (typeof balance !== 'number') {
          console.error(`Balance inválido para tarjeta ${card.nameAccount}:`, balance);
          return null;
        }

        const formattedBalance = this.formatCurrency(Math.abs(balance));
        const name = this.truncateText(card.nameAccount || '', 15);
        const fullName = `${card.nameAccount} (${formattedBalance})`;

        return {
          name,
          value: Math.abs(balance),
          originalValue: balance,
          cardName: card.nameAccount,
          fullName,
          formattedBalance
        };
      })
      .filter((item): item is ChartDataItem => item !== null);

    console.log('📊 Datos del gráfico:', this.chartData);
  }

  onResize() {
    const container = this.chartContainer?.nativeElement;
    if (!container) return;

    const containerWidth = container.offsetWidth;
    const containerHeight = container.offsetHeight;
    const width = Math.min(containerWidth, 800);
    const height = Math.min(containerHeight, 400);

    this.view = [width, height];
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(value);
  }

  truncateText(text: string | number, maxLength: number): string {
    const textStr = text.toString();
    return textStr.length > maxLength ? textStr.slice(0, maxLength) + '...' : textStr;
  }

  ngAfterViewInit() {
    this.onResize();
  }

  async onCardDeleted(cardId: number): Promise<void> {
    try {
      this.isDeleting = true;
      // 🔄 El servicio actualiza automáticamente el cache
      await firstValueFrom(this.cardService.deleteCard(cardId));
      
      this.snackBar.open('Tarjeta eliminada exitosamente', 'Cerrar', {
        duration: 3000,
        panelClass: ['snack-success']
      });
      
      // ❌ Ya no necesitamos llamar loadCards() manualmente
      // this.cards = await firstValueFrom(this.cardService.getCards());
      
    } catch (error) {
      console.error('Error al eliminar tarjeta:', error);
      this.snackBar.open('Error al eliminar la tarjeta', 'Cerrar', {
        duration: 3000,
        panelClass: ['snack-error']
      });
    } finally {
      this.isDeleting = false;
    }
  }

  async syncAllCards(): Promise<void> {
    try {
      this.isSyncingAll = true;
      
      // 🔄 El servicio actualiza automáticamente el cache
      await firstValueFrom(this.cardService.syncAllCards());
      
      this.snackBar.open('Todas las tarjetas sincronizadas', 'Cerrar', {
        duration: 3000,
        panelClass: ['snack-success']
      });
      
      // ❌ Ya no necesitamos llamar loadCards() manualmente
      // this.cards = await firstValueFrom(this.cardService.getCards());
      
    } catch (error) {
      console.error('Error al sincronizar tarjetas:', error);
      this.snackBar.open('Error al sincronizar las tarjetas', 'Cerrar', {
        duration: 3000,
        panelClass: ['snack-error']
      });
    } finally {
      this.isSyncingAll = false;
    }
  }
}
