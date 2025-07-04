import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSelectModule } from '@angular/material/select';
import { MovementService } from '../../../services/movement.service';
import { CardService } from '../../../services/card.service';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Card } from '../../../models/card.model';
import { LimitNotificationsService } from '../../../services/limit-notifications.service';
import { PlanLimitsService } from '../../../services/plan-limits.service';
import { FeatureControlService } from '../../../services/feature-control.service';
import { LimitNotificationComponent, LimitNotificationData } from '../../../shared/components/limit-notification/limit-notification.component';
import { PLAN_LIMITS } from '../../../models/plan.model';
import { PlanLimitAlertService } from '../../../shared/services/plan-limit-alert.service';
import { Router } from '@angular/router';
import { Subject, takeUntil, Observable, map } from 'rxjs';
import { Movement } from '../../../models/movement.model';
import { Category } from '../../../models/category.model';

@Component({
  selector: 'app-add-movement',
  standalone: true,
  templateUrl: './add-movement.component.html',
  styleUrls: ['./add-movement.component.css'],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatTabsModule,
    MatIconModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    LimitNotificationComponent
  ],
})
export class AddMovementComponent implements OnInit, OnDestroy {
  manualForm: FormGroup;
  selectedFile: File | null = null;
  uploadError: string | null = null;
  isUploading = false;
  isProcessing = false; // 🔒 Protección contra múltiples ejecuciones
  private hasSubmitted = false; // 🔒 Protección adicional contra múltiples envíos
  private componentDestroyed = false; // 🔒 Protección contra ejecuciones después de destruir
  private destroy$ = new Subject<void>(); // 🔒 Subject para manejar suscripciones
  private processingId: string | null = null; // 🔒 ID único para el procesamiento actual
  cards: Card[] = [];
  minDate: string; // Fecha mínima para el input de fecha

  // Variables para límites
  limitsInfo: any = null;
  showLimitNotification = false;
  limitNotificationData: LimitNotificationData = {
    type: 'warning',
    title: '',
    message: '',
    limit: 0,
    current: 0,
    showUpgradeButton: false
  };

  // 🔄 Observable reactivo que filtra tarjetas de efectivo
  cards$: Observable<Card[]>;

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<AddMovementComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { 
      cardId?: number;
      isUpdate?: boolean;
      movement?: Movement;
    },
    private movementService: MovementService,
    private cardService: CardService,
    private snackBar: MatSnackBar,
    private limitNotificationsService: LimitNotificationsService,
    private planLimitsService: PlanLimitsService,
    private featureControlService: FeatureControlService,
    private planLimitAlertService: PlanLimitAlertService,
    private router: Router
  ) {
    // Obtener fecha mínima (hoy)
    this.minDate = new Date().toISOString().split('T')[0];
    
    this.manualForm = this.fb.group({
      cardId: ['', Validators.required],
      transactionDate: [this.minDate, [Validators.required, this.minDateValidator(this.minDate)]],
      description: ['', Validators.required],
      amount: [0, [Validators.required, Validators.min(0)]],
      movementType: ['', Validators.required],
    });

    // 🔄 Observable reactivo que filtra automáticamente las tarjetas de efectivo
    this.cards$ = this.cardService.cards$.pipe(
      map(cards => {
        console.log('🔄 [AddMovement] Observable: Tarjetas recibidas del servicio:', cards.length);
        cards.forEach(card => {
          console.log(`  - Entrada: ID ${card.id}, Name: "${card.nameAccount}", Status: "${card.statusAccount}"`);
        });
        
        // 🚫 Filtrar tarjetas de efectivo e inactivas
        const filteredCards = cards.filter(card => {
          const isNotCash = card.nameAccount.toLowerCase() !== 'efectivo';
          const isActive = card.statusAccount === 'active';
          const shouldInclude = isNotCash && isActive;
          
          console.log(`  - Filtro para ID ${card.id}: isNotCash=${isNotCash}, isActive=${isActive}, incluir=${shouldInclude}`);
          
          return shouldInclude;
        });

        console.log('🔄 [AddMovement] Observable: Después del primer filtro:', filteredCards.length);

        // 📝 Normalizar nombres y eliminar duplicados
        const seen = new Set();
        const normalizedCards = filteredCards.filter(card => {
          const normalized = this.normalizeCardName(card.nameAccount);
          const isUnique = !seen.has(normalized);
          
          if (isUnique) {
            seen.add(normalized);
            card.nameAccount = normalized;
            console.log(`  - Normalizada: ID ${card.id}, Name: "${normalized}"`);
          } else {
            console.log(`  - Duplicada (excluida): ID ${card.id}, Name: "${normalized}"`);
          }
          
          return isUnique;
        });

        console.log('🔄 [AddMovement] Observable: Tarjetas finales después de normalización:', normalizedCards.length);
        normalizedCards.forEach(card => {
          console.log(`  - Final: ID ${card.id}, Name: "${card.nameAccount}"`);
        });

        return normalizedCards;
      })
    );
  }

  ngOnInit() {
    // 🔒 Limpiar estado previo ANTES de cargar datos
    this.resetComponentState();
    
    // 🔄 Inicializar datos reactivos
    this.initializeData();
    
    // 🔄 Suscribirse a cambios en las tarjetas para actualizar el array local
    this.cards$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(cards => {
      console.log('🔄 [AddMovement] Tarjetas recibidas del Observable:', cards.length);
      cards.forEach(card => {
        console.log(`  - ID: ${card.id}, Name: ${card.nameAccount}, Status: ${card.statusAccount}`);
      });
      
      this.cards = cards;
      
      // Si la tarjeta seleccionada ya no existe, limpiar la selección
      const selectedCardId = this.manualForm.get('cardId')?.value;
      if (selectedCardId && !this.cards.find(card => card.id === Number(selectedCardId))) {
        console.log(`⚠️ [AddMovement] Tarjeta seleccionada ${selectedCardId} ya no está disponible`);
        this.manualForm.patchValue({ cardId: '' });
        this.snackBar.open('La tarjeta seleccionada ya no está disponible', 'Cerrar', { duration: 3000 });
      }
      
      // Si no hay tarjetas disponibles, mostrar advertencia
      if (this.cards.length === 0) {
        console.log('⚠️ [AddMovement] No hay tarjetas disponibles');
        this.snackBar.open('No hay tarjetas disponibles. Crea una tarjeta primero.', 'Cerrar', { duration: 5000 });
      } else {
        console.log(`✅ [AddMovement] ${this.cards.length} tarjetas disponibles para movimientos`);
      }
    });
  }

  ngOnDestroy() {
    console.log('🔄 [AddMovement] Destruyendo componente');
    this.componentDestroyed = true;
    this.destroy$.next();
    this.destroy$.complete();
  }

  private resetComponentState(): void {
    // Limpiar estado del componente (sin tocar las tarjetas si ya están cargadas)
    this.selectedFile = null;
    this.uploadError = null;
    this.isUploading = false;
    this.isProcessing = false; // 🔒 Resetear estado de procesamiento
    this.hasSubmitted = false; // 🔒 Resetear estado de envío
    this.processingId = null; // 🔒 Resetear ID de procesamiento
    this.showLimitNotification = false;
    
    console.log('🔄 [AddMovement] Estado del componente limpiado (tarjetas preservadas)');
  }

  private forceReloadCards(): void {
    // Limpiar cache local y recargar
    console.log('🔄 [AddMovement] Forzando recarga de tarjetas...');
    this.cards = [];
    this.manualForm.patchValue({ cardId: '' });
    
    // Recargar desde servidor usando el sistema reactivo
    this.cardService.getCards().subscribe();
  }

  // Validador personalizado para fecha mínima
  private minDateValidator(minDate: string) {
    return (control: any) => {
      if (!control.value) {
        return null;
      }
      const selectedDate = new Date(control.value);
      const minDateObj = new Date(minDate);
      return selectedDate < minDateObj ? { minDate: true } : null;
    };
  }

  private initializeData(): void {
    // 🔄 Cargar tarjetas usando el sistema reactivo
    this.cardService.getCards().subscribe();
    
    // Cargar otros datos necesarios
    this.loadInitialData();
  }

  private loadInitialData(): void {
    // 🔄 Ya no necesitamos cargar tarjetas manualmente
    // Las tarjetas se actualizan automáticamente a través del observable filtrado
    
    // Solo cargar otros datos que necesitemos
    this.loadCategories();
    this.loadLimitsInfo();
  }

  private loadCategories(): void {
    // Cargar categorías si es necesario
  }

  private loadLimitsInfo(): void {
    // Cargar información de límites
    this.planLimitsService.currentUsage$.pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (usage) => {
        this.limitsInfo = usage;
      },
      error: (error) => {
        console.error('Error al cargar límites:', error);
      }
    });
  }

  getProgressPercentage(limitKey: string): number {
    if (!this.limitsInfo || !this.limitsInfo[limitKey]) return 0;
    const limit = this.limitsInfo[limitKey];
    return Math.min((limit.used / limit.limit) * 100, 100);
  }

  displayLimitNotification(data: LimitNotificationData): void {
    this.limitNotificationData = data;
    this.showLimitNotification = true;
  }

  hideLimitNotification(): void {
    this.showLimitNotification = false;
  }

  // Método para abrir el selector de fecha
  openDatePicker(): void {
    const dateInput = document.querySelector('.date-input') as HTMLInputElement;
    if (dateInput) {
      dateInput.showPicker();
    }
  }

  normalizeCardName(name: string): string {
    return name
      .toUpperCase()
      .replace(/\s+/g, ' ')
      .replace(/[^A-Z0-9\s]/g, '')
      .trim();
  }

  async isDuplicateMovement(): Promise<boolean> {
    const { cardId, description, transactionDate, amount } = this.manualForm.value;

    // Validar que los datos están completos
    if (!cardId || !description || !transactionDate || !amount) {
      console.log('🔍 [AddMovement] Datos incompletos para validación de duplicados');
      return false;
    }

    try {
      console.log('🔍 [AddMovement] Verificando duplicados:');
      console.log(`  - CardId: ${cardId}`);
      console.log(`  - Fecha: ${transactionDate}`);
      console.log(`  - Descripción: "${description}"`);
      console.log(`  - Monto: ${amount}`);
      
      const movements = await this.movementService
        .getFilteredMovements({
          cardId: Number(cardId),
          startDate: new Date(transactionDate),
          endDate: new Date(transactionDate),
          movementSource: 'manual'
        })
        .pipe(takeUntil(this.destroy$))
        .toPromise();
        
      console.log('🔍 [AddMovement] Movimientos encontrados:', movements?.length || 0);
      
      if (movements && movements.length > 0) {
        movements.forEach((m, index) => {
          console.log(`  - Movimiento ${index + 1}:`, {
            id: m.id,
            description: m.description,
            amount: m.amount,
            date: m.transactionDate
          });
        });
        
                 const duplicateFound = movements.some(m => {
           const currentDesc = description.toLowerCase().trim();
           const existingDesc = m.description?.toLowerCase().trim() || '';

           let isDescriptionMatch = false;
           if (currentDesc.length <= 5 || existingDesc.length <= 5) {
             isDescriptionMatch = currentDesc === existingDesc;
           } else {
             // Para descripciones más largas, permite inclusión pero con longitud mínima
             const minMatchLength = Math.min(currentDesc.length, existingDesc.length);
             if (minMatchLength >= 5) {
               isDescriptionMatch = currentDesc.includes(existingDesc) || existingDesc.includes(currentDesc);
             }
           }
           
           const isAmountMatch = Number(m.amount) === Number(amount);
           
           console.log(`  - Comparando con movimiento ${m.id}:`, {
             currentDesc: currentDesc,
             existingDesc: existingDesc,
             currentLength: currentDesc.length,
             existingLength: existingDesc.length,
             descriptionMatch: isDescriptionMatch,
             amountMatch: isAmountMatch,
             isDuplicate: isDescriptionMatch && isAmountMatch
           });
           
           return isDescriptionMatch && isAmountMatch;
         });
        
        console.log('🔍 [AddMovement] ¿Duplicado encontrado?', duplicateFound);
        return duplicateFound;
      }
      
      console.log('🔍 [AddMovement] No se encontraron movimientos para esta fecha');
      return false;
    } catch (error) {
      console.error('❌ [AddMovement] Error al validar duplicado:', error);
      return false;
    }
  }

  async onSubmit() {
    // 🔒 Múltiples protecciones contra ejecuciones duplicadas
    if (this.componentDestroyed) {
      console.log('🔒 [AddMovement] Componente destruido, ignorando...');
      return;
    }

    if (this.isProcessing || this.hasSubmitted) {
      console.log('🔒 [AddMovement] Ya se está procesando o ya se envió, ignorando...');
      return;
    }

    if (!this.manualForm.valid) {
      console.log('🔒 [AddMovement] Formulario inválido, ignorando...');
      return;
    }

    // Verificar que la tarjeta seleccionada existe en las tarjetas cargadas
    const selectedCardId = this.manualForm.get('cardId')?.value;
    const selectedCard = this.cards.find(card => card.id === Number(selectedCardId));
    
    if (!selectedCard) {
      console.log(`❌ [AddMovement] Tarjeta seleccionada ${selectedCardId} no encontrada`);
      console.log('📋 [AddMovement] Tarjetas disponibles:', this.cards.map(c => ({ id: c.id, name: c.nameAccount })));
      
      // Si no hay tarjetas cargadas, intentar cargar
      if (this.cards.length === 0) {
        console.log('🔄 [AddMovement] Intentando cargar tarjetas...');
        this.cardService.getCards().subscribe();
        this.snackBar.open('Cargando tarjetas, por favor espera un momento...', 'Cerrar', { duration: 3000 });
        return;
      }
      
      // Si hay tarjetas pero la seleccionada no existe
      this.snackBar.open('Por favor, selecciona una tarjeta válida.', 'Cerrar', { duration: 3000 });
      this.manualForm.patchValue({ cardId: '' });
      return;
    }

    // Generar ID único para este procesamiento
    const currentProcessingId = `processing-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.processingId = currentProcessingId;
    this.isProcessing = true;
    this.hasSubmitted = true;
    
    console.log(`🔒 [AddMovement] Iniciando procesamiento único ID: ${currentProcessingId}`);
    console.log(`🎯 [AddMovement] Tarjeta seleccionada: ID ${selectedCard.id} - ${selectedCard.nameAccount}`);
    
    // Verificar límites antes de crear el movimiento
    this.planLimitsService.getLimitStatusInfo(PLAN_LIMITS.MANUAL_MOVEMENTS).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (limitStatus) => {
        // Verificar que este procesamiento sigue siendo válido
        if (this.processingId !== currentProcessingId || this.componentDestroyed) {
          console.log('🔒 [AddMovement] Procesamiento obsoleto, ignorando...');
          return;
        }

        // Si el límite es -1, significa que es ilimitado
        if (limitStatus.limit === -1) {
          this.createMovement(currentProcessingId);
          return;
        }
        
        // Verificar límite solo si no es ilimitado
        if (limitStatus.currentUsage >= limitStatus.limit) {
          this.planLimitAlertService.showMovementLimitAlert(limitStatus.currentUsage, limitStatus.limit).pipe(
            takeUntil(this.destroy$)
          ).subscribe({
            next: (result) => {
              if (result.action === 'upgrade') {
                this.router.navigate(['/plans']);
              }
              this.resetProcessingState();
            }
          });
          return;
        }

        // Continuar con la creación del movimiento
        this.createMovement(currentProcessingId);
      },
      error: (error) => {
        console.error('Error al verificar límites:', error);
        if (this.processingId === currentProcessingId && !this.componentDestroyed) {
          this.createMovement(currentProcessingId);
        }
      }
    });
  }

  private resetProcessingState(): void {
    this.isProcessing = false;
    this.hasSubmitted = false;
    this.processingId = null;
    console.log('🔒 [AddMovement] Estado de procesamiento reseteado');
  }

  private async createMovement(processingId?: string) {
    // 🔒 Verificar que el procesamiento sigue siendo válido
    if (processingId && this.processingId !== processingId) {
      console.log('🔒 [AddMovement] Procesamiento obsoleto en createMovement, ignorando...');
      return;
    }

    if (this.componentDestroyed) {
      console.log('🔒 [AddMovement] Componente destruido en createMovement, ignorando...');
      return;
    }

    console.log('🚀 [AddMovement] Iniciando creación de movimiento');
    console.log('📋 [AddMovement] Datos del formulario:', this.manualForm.value);
    
    // Validar que la tarjeta seleccionada aún existe
    const selectedCardId = this.manualForm.get('cardId')?.value;
    const selectedCard = this.cards.find(card => card.id === Number(selectedCardId));
    
    console.log('🔍 [AddMovement] Validando tarjeta seleccionada:');
    console.log(`  - ID seleccionado: ${selectedCardId}`);
    console.log(`  - Tarjeta encontrada:`, selectedCard);
    console.log(`  - Tarjetas disponibles:`, this.cards.map(c => ({ id: c.id, name: c.nameAccount })));
    
    if (!selectedCard) {
      this.snackBar.open('La tarjeta seleccionada ya no está disponible. Por favor, selecciona otra tarjeta.', 'Cerrar', { duration: 5000 });
      // Recargar tarjetas para mostrar las disponibles
      this.forceReloadCards();
      this.resetProcessingState();
      return;
    }

    const isDuplicate = await this.isDuplicateMovement();
    if (isDuplicate) {
      // Mostrar confirmación en lugar de bloquear completamente
      const confirmCreate = confirm('Ya existe un movimiento similar en esta fecha. ¿Deseas crear el movimiento de todas formas?');
      if (!confirmCreate) {
        console.log('🔍 [AddMovement] Usuario canceló la creación del movimiento duplicado');
        this.resetProcessingState();
        return;
      }
      console.log('🔍 [AddMovement] Usuario confirmó crear movimiento duplicado');
    }

    const movementData = {
      ...this.manualForm.value,
      movementSource: 'manual'
    };
    
    console.log('📤 [AddMovement] Enviando datos al backend:', movementData);
    
    this.movementService.addMovement(movementData).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: () => {
        // Verificar que el procesamiento sigue siendo válido
        if (processingId && this.processingId !== processingId) {
          console.log('🔒 [AddMovement] Procesamiento obsoleto en respuesta, ignorando...');
          return;
        }

        console.log('✅ [AddMovement] Movimiento creado exitosamente');
        this.snackBar.open('Movimiento agregado exitosamente', 'Cerrar', { duration: 3000 });
        this.resetProcessingState();
        
        if (!this.componentDestroyed) {
          this.dialogRef.close(true);
        }
      },
      error: (error) => {
        // Verificar que el procesamiento sigue siendo válido
        if (processingId && this.processingId !== processingId) {
          console.log('🔒 [AddMovement] Procesamiento obsoleto en error, ignorando...');
          return;
        }

        console.error('❌ [AddMovement] Error al agregar movimiento:', error);
        this.snackBar.open(error.message || 'Error al agregar el movimiento', 'Cerrar', { duration: 3000 });
        this.resetProcessingState();
        
        // Si el error es sobre tarjeta no encontrada, forzar recarga
        if (error.message && error.message.includes('Tarjeta no encontrada')) {
          this.forceReloadCards();
        }
      }
    });
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      if (file.type !== 'application/pdf') {
        this.uploadError = 'Solo se permiten archivos PDF';
        this.selectedFile = null;
        return;
      }
      this.selectedFile = file;
      this.uploadError = null;
    }
  }

  onUploadCartola(): void {
    if (!this.selectedFile) {
      this.uploadError = 'Debes seleccionar una cartola en PDF';
      return;
    }

    // Verificar permisos antes de subir cartola
    this.limitNotificationsService.checkLimitBeforeAction('upload_cartola').pipe(
      takeUntil(this.destroy$)
    ).subscribe(result => {
      if (!result.canProceed && result.notification?.limitCheck) {
        // Si el límite no es ilimitado, mostrar alerta
        if (result.notification.limitCheck.limit !== -1) {
          this.planLimitAlertService.showCartolaLimitAlert(
            result.notification.limitCheck.used || 0,
            result.notification.limitCheck.limit || 0
          ).pipe(
            takeUntil(this.destroy$)
          ).subscribe({
            next: (alertResult) => {
              if (alertResult.action === 'upgrade') {
                this.router.navigate(['/plans']);
              }
            }
          });
          return;
        }
      }

      // Continuar con la subida de cartola
      this.uploadCartola();
    });
  }

  private uploadCartola(): void {
    const formData = new FormData();
    formData.append('cartola', this.selectedFile!);

    this.isUploading = true;
    this.uploadError = null;

    this.movementService.uploadCartola(formData).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: () => {
        this.snackBar.open('¡Cartola procesada exitosamente!', 'Cerrar', { duration: 3000 });
        if (!this.componentDestroyed) {
          this.dialogRef.close(true);
        }
      },
      error: (err) => {
        console.error('Error al procesar cartola:', err);
        this.uploadError = err.error?.message || 'Ocurrió un error al procesar la cartola';
        this.isUploading = false;
      }
    });
  }

  removeFile(): void {
    this.selectedFile = null;
    this.uploadError = null;
  }
}