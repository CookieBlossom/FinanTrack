import { Component, Inject, OnInit } from '@angular/core';
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
export class AddMovementComponent implements OnInit {
  manualForm: FormGroup;
  selectedFile: File | null = null;
  uploadError: string | null = null;
  isUploading = false;
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

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<AddMovementComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
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
  }

  ngOnInit() {
    this.loadCards();
    this.loadLimitsInfo();
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

  loadLimitsInfo(): void {
    // Cargar información de límites
    this.planLimitsService.currentUsage$.subscribe({
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

  loadCards() {
    this.cardService.getCards().subscribe(
      cards => {
        const seen = new Set();
        this.cards = cards.filter(card => {
          // Filtrar tarjetas de efectivo
          if (card.nameAccount.toLowerCase() === 'efectivo') {
            return false;
          }
          
          const normalized = this.normalizeCardName(card.nameAccount);
          if (seen.has(normalized)) return false;
          seen.add(normalized);
          card.nameAccount = normalized;
          return true;
        });
      },
      error => {
        console.error('Error al cargar tarjetas:', error);
        this.snackBar.open('Error al cargar las tarjetas', 'Cerrar', { duration: 3000 });
      }
    );
  }

  async isDuplicateMovement(): Promise<boolean> {
    const { cardId, description, transactionDate, amount } = this.manualForm.value;

    try {
      const movements = await this.movementService
        .getFilteredMovements({
          cardId: Number(cardId),
          startDate: new Date(transactionDate),
          endDate: new Date(transactionDate),
          movementSource: 'manual'
        })
        .toPromise();
      if (movements) {
        return movements.some(m =>
          m.description?.toLowerCase().trim() === description.toLowerCase().trim() &&
          Number(m.amount) === Number(amount)
        );
      }
      return false;
    } catch (error) {
      console.error('Error al validar duplicado:', error);
      return false;
    }
  }

  async onSubmit() {
    if (this.manualForm.valid) {
      const selectedCardId = this.manualForm.get('cardId')?.value;
      const selectedCard = this.cards.find(card => card.id === selectedCardId);
      
      // Verificar que no se esté intentando crear un movimiento en una tarjeta de efectivo
      if (selectedCard && selectedCard.nameAccount.toLowerCase() === 'efectivo') {
        this.snackBar.open('No puedes crear movimientos normales en tarjetas de efectivo. Usa "Movimiento en Efectivo" en su lugar.', 'Cerrar', { duration: 5000 });
        return;
      }
      // Verificar límites antes de crear el movimiento
      this.planLimitsService.getLimitStatusInfo(PLAN_LIMITS.MANUAL_MOVEMENTS).subscribe({
        next: (limitStatus) => {
          if (limitStatus.currentUsage >= limitStatus.limit) {
            // Mostrar alerta modal en lugar de notificación
            this.planLimitAlertService.showMovementLimitAlert(limitStatus.currentUsage, limitStatus.limit).subscribe({
              next: (result) => {
                if (result.action === 'upgrade') {
                  this.router.navigate(['/plans']);
                }
                // Si es dismiss, no hacer nada y dejar que el usuario continúe
              }
            });
            return;
          }

          // Continuar con la creación del movimiento
          this.createMovement();
        },
        error: (error) => {
          console.error('Error al verificar límites:', error);
          // Continuar sin verificación en caso de error
          this.createMovement();
        }
      });
    }
  }

  private async createMovement() {
    const isDuplicate = await this.isDuplicateMovement();
    if (isDuplicate) {
      this.snackBar.open('Ya existe un movimiento similar en esta fecha', 'Cerrar', { duration: 3000 });
      return;
    }

    const movementData = {
      ...this.manualForm.value,
      movementSource: 'manual'
    };
    this.movementService.addMovement(movementData).subscribe({
      next: () => {
        this.snackBar.open('Movimiento agregado exitosamente', 'Cerrar', { duration: 3000 });
        this.dialogRef.close(true);
      },
      error: (error) => {
        console.error('Error al agregar movimiento:', error);
        this.snackBar.open(error.message || 'Error al agregar el movimiento', 'Cerrar', { duration: 3000 });
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
    this.limitNotificationsService.checkLimitBeforeAction('upload_cartola').subscribe(result => {
      if (!result.canProceed) {
        // Mostrar alerta modal en lugar de error simple
        this.planLimitAlertService.showCartolaLimitAlert(0, 0).subscribe({
          next: (alertResult) => {
            if (alertResult.action === 'upgrade') {
              this.router.navigate(['/plans']);
            }
            // Si es dismiss, no hacer nada
          }
        });
        return;
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

    this.movementService.uploadCartola(formData).subscribe({
      next: () => {
        this.snackBar.open('¡Cartola procesada exitosamente!', 'Cerrar', { duration: 3000 });
        this.dialogRef.close(true);
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