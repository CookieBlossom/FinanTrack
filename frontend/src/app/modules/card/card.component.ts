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
import { takeUntil, map } from 'rxjs/operators';
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
  error: string | null = null;
  totalBalance: number = 0;
  limitsInfo: any = null;
  loading = false;
  syncing = false;
  private destroy$ = new Subject<void>();
  colorScheme: any = {
    domain: [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD',
      '#98D8C8', '#F7DC6F', '#AED6F1', '#F8C471', '#D7BDE2', '#A9DFBF',
      '#F9E79F', '#FAD7A0', '#D5A6BD', '#85C1E9', '#F8D7DA', '#D1ECF1',
      '#FFF3CD', '#D4EDDA', '#E2E3E5', '#F5C6CB', '#B8DAFF', '#C3E6CB',
      '#FFEAA7', '#74B9FF', '#E17055', '#00B894', '#FDCB6E', '#6C5CE7'
    ]
  };

  // 🔄 Propiedades reactivas computadas - se inicializan en el constructor
  cards$!: Observable<Card[]>;
  loading$!: Observable<boolean>;
  visibleCards$!: Observable<Card[]>;
  totalBalance$!: Observable<number>;
  chartData$!: Observable<ChartDataItem[]>;
  hasCards$!: Observable<boolean>;

  chartView: [number, number] = [0, 0]; // Se calculará dinámicamente
  chartData: ChartDataItem[] = [];
  view: [number, number] = [700, 400];
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
    // 🔄 Inicializar propiedades reactivas
    this.cards$ = this.cardService.cards$;
    this.loading$ = this.cardService.loading$;
    
    // 🔄 Propiedades computadas derivadas
    this.visibleCards$ = this.cards$.pipe(
      map(cards => cards.filter(card => card.nameAccount.toLowerCase() !== 'efectivo'))
    );
    
    this.totalBalance$ = this.cards$.pipe(
      map(cards => cards
        .filter(card => card.statusAccount === 'active' && card.nameAccount.toLowerCase() !== 'efectivo')
        .reduce((total, card) => total + (card.balance || 0), 0)
      )
    );
    
    this.chartData$ = this.cards$.pipe(
      map(cards => this.computeChartData(cards))
    );
    
    this.hasCards$ = this.visibleCards$.pipe(
      map(cards => cards.length > 0)
    );
  }
  
  chartLabels: string[] = [];
  
  async ngOnInit(): Promise<void> {
    console.log('🔄 [CardComponent] Iniciando componente...');
        this.initializeReactiveData();
    this.cardService.getCards().subscribe();
    
    await this.loadInitialData();
    this.calculateChartSize();

    let resizeTimeout: any;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        this.calculateChartSize();
      }, 250);
    });
  }
  private initializeReactiveData(): void {
    // Suscribirse a cambios en las tarjetas para actualizar el gráfico
    this.chartData$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(data => {
      this.chartData = data;
      this.changeDetectorRef.markForCheck();
    });
    
    // Suscribirse a cambios en el balance total
    this.totalBalance$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(balance => {
      this.totalBalance = balance;
      this.changeDetectorRef.markForCheck();
    });
  }
  
  // 🔄 Computar datos del gráfico (función pura)
  private computeChartData(cards: Card[]): ChartDataItem[] {
    // Filtrar tarjetas activas con saldo (positivo o negativo)
    const activeCards = cards.filter(card => 
      card.statusAccount === 'active' && 
      card.nameAccount.toLowerCase() !== 'efectivo'
    );
    
    // Si no hay tarjetas activas, retornar array vacío
    if (activeCards.length === 0) {
      console.log('📊 No hay tarjetas activas para mostrar en el gráfico');
      return [];
    }
    
    return activeCards.map(card => {
      let balance = 0;
      if (typeof card.balance === 'number' && !isNaN(card.balance)) {
        balance = card.balance;
      } else if (typeof card.balance === 'string') {
        balance = parseFloat(card.balance) || 0;
      }
      
      const displayName = card.nameAccount;
      const absoluteBalance = Math.abs(balance);
      
      return {
        name: this.truncateText(displayName, 15),
        value: absoluteBalance,
        originalValue: balance,
        cardName: displayName,
        fullName: displayName,
        formattedBalance: this.formatCurrency(balance)
      };
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
      // 1. Cargar límites (no bloqueante)
      this.loadLimitsInfo();
      
      console.log('✅ Datos cargados exitosamente');
      
    } catch (error) {
      console.error('❌ Error al cargar datos iniciales:', error);
      this.error = 'No se pudieron cargar las tarjetas';
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

  // 🔄 Método simplificado para actualizar datos
  private async updateData(): Promise<void> {
    try {
      this.error = null;
      // Refrescar datos usando sistema reactivo
      await firstValueFrom(this.cardService.refreshCards());
      this.planLimitsService.refreshUsage();
      
      setTimeout(() => {
        this.calculateChartSize();
      }, 100);
      
    } catch (error) {
      console.error('Error al actualizar datos:', error);
      this.error = 'Error al actualizar los datos. Por favor, intenta nuevamente.';
      throw error;
    }
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
  
  // 🔄 Método obsoleto - ahora se usa totalBalance$
  getTotalBalance(): number {
    return this.totalBalance;
  }
  
  // 🔄 Método obsoleto - ahora se usa chartData$
  getPieChartData() {
    return this.chartData;
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
