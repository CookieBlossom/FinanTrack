import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
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
import { firstValueFrom, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { NgxChartsModule } from '@swimlane/ngx-charts';
import { EditCardDialogComponent } from './edit-card-dialog/edit-card-dialog.component';
import { DeleteCardDialogComponent } from './delete-card-dialog/delete-card-dialog.component';
import { FeatureControlDirective } from '../../shared/directives/feature-control.directive';
import { PlanLimitsService } from '../../services/plan-limits.service';

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
  ]
})
export class CardComponent implements OnInit, OnDestroy {
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
  chartView: [number, number] = [350, 250];

  constructor(
    private cardService: CardService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private planLimitsService: PlanLimitsService,
    private changeDetectorRef: ChangeDetectorRef
  ) {}
  
  chartLabels: string[] = [];
  chartData: number[] = [];
  
  async ngOnInit(): Promise<void> {
    await this.loadInitialData();
    this.updateChartSize();
    window.addEventListener('resize', () => {
      setTimeout(() => this.updateChartSize(), 100);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    window.removeEventListener('resize', () => this.updateChartSize());
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
      this.planLimitsService.currentUsage$.pipe(
        takeUntil(this.destroy$)
      ).subscribe({
        next: (usage) => {
          this.limitsInfo = usage;
        },
        error: (error) => {
          console.error('Error al cargar límites:', error);
          // No establecer error global, solo log
        }
      });
    } catch (error) {
      console.error('Error al cargar información de límites:', error);
      // No establecer error global, solo log
    }
  }
  
  private async loadCardsAndBalance(): Promise<void> {
    try {
      // Cargar tarjetas primero
      await this.loadCards();
      
      // Calcular balance total basado en las tarjetas cargadas
      this.totalBalance = this.getTotalBalance();
      
    } catch (error) {
      console.error('Error al cargar tarjetas y balance:', error);
      // Si falla la carga de tarjetas, establecer arrays vacíos
      this.cards = [];
      this.totalBalance = 0;
      throw error; // Re-lanzar para manejo en loadInitialData
    }
  }
  
  private async loadCards(): Promise<void> {
    try {
      console.log('📞 Llamando al servicio de tarjetas...');
      this.cards = await firstValueFrom(this.cardService.getCards());
      console.log('📋 Tarjetas cargadas:', this.cards.length);
    } catch (error) {
      console.error('❌ Error al cargar tarjetas:', error);
      // Si falla, establecer array vacío
      this.cards = [];
      throw error; // Re-lanzar para manejo en loadCardsAndBalance
    }
  }

  private async updateData(): Promise<void> {
    try {
      // Limpiar error antes de actualizar
      this.error = null;
      
      // Forzar recarga completa de datos
      await this.loadCardsAndBalance();
      
      // Actualizar límites también
      await this.loadLimitsInfo();
      
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
      width: '60vw',
      height: '90vh',
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
      
      const displayName = card.aliasAccount || card.nameAccount;
      
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
      const legendName = displayName.length > 20 ? displayName.substring(0, 20) + '...' : displayName;
      
      const result = {
        name: legendName, // Nombre corto para la leyenda
        value: Math.abs(balance), // Usar valor absoluto para el gráfico
        originalValue: balance, // Guardar el valor original para referencias
        cardName: displayName, // Nombre completo para tooltip
        fullName: `${displayName} (${formattedBalance})` // Nombre completo con balance
      };
      
      console.log(`📊 Resultado final para gráfico:`, result);
      return result;
    });
    
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
  
  async deleteCard(cardId: number, cardName?: string): Promise<void> {
    const dialogRef = this.dialog.open(DeleteCardDialogComponent, {
      width: '380px',
      data: { cardName }
    });
    const confirmed = await firstValueFrom(dialogRef.afterClosed());
  
    if (!confirmed) return;
  
    try {
      this.snackBar.open('Eliminando tarjeta...', 'Cerrar', { duration: 2000 });
      await firstValueFrom(this.cardService.deleteCard(cardId));
      await this.updateData();
      this.snackBar.open('Tarjeta eliminada exitosamente', 'Cerrar', { duration: 3000 });
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
      await firstValueFrom(this.cardService.syncAllCards());
      await this.updateData();
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

  // Método para actualizar el tamaño del gráfico según el contenedor
  updateChartSize(): void {
    // Usar setTimeout para asegurar que el DOM esté actualizado
    setTimeout(() => {
      const chartContainer = document.querySelector('.chart-wrapper');
      if (chartContainer) {
        const rect = chartContainer.getBoundingClientRect();
        const width = Math.max(rect.width, 300); // 40px de padding
        const height = Math.max(rect.height, 250); // 40px de padding
        
        this.chartView = [width, height];
        console.log(`📏 Gráfico redimensionado a: ${width}x${height}`);
        this.changeDetectorRef.detectChanges();
      }
    }, 100);
  }
}
