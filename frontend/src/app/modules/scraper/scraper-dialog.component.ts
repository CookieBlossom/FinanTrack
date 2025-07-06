import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ScraperService, ScraperTask } from '../../services/scraper.service';
import { Subscription } from 'rxjs';
import { WebSocketService } from '../../services/web-socket.service';

@Component({
  selector: 'app-scraper-dialog',
  template: `
    <h2 mat-dialog-title>
      <mat-icon>sync</mat-icon>
      Scraper Automático - Banco Estado
    </h2>

    <mat-dialog-content>
      <div *ngIf="currentTask && currentTask.status !== 'completed'" class="task-progress">
        <div class="progress-header">
          <h3>{{ currentTask.message }}</h3>
          <span class="progress-percentage">{{ currentTask.progress }}%</span>
        </div>
        
        <mat-progress-bar 
          [value]="currentTask.progress" 
          mode="determinate"
          color="primary">
        </mat-progress-bar>
        
        <div class="progress-actions">
          <button 
            mat-button 
            color="warn" 
            (click)="cancelTask()" 
            [disabled]="currentTask.status === 'cancelling'">
            <mat-icon>stop</mat-icon>
            Cancelar
          </button>
        </div>
      </div>

      <div *ngIf="!currentTask || currentTask.status === 'completed'" class="scraper-form">
        <form [formGroup]="scraperForm" (ngSubmit)="startScraping()">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>RUT</mat-label>
            <input 
              matInput 
              formControlName="rut" 
              placeholder="12.345.678-9"
              (blur)="formatRutField()"
              maxlength="12">
            <mat-error *ngIf="scraperForm.get('rut')?.hasError('required')">
              El RUT es requerido
            </mat-error>
            <mat-error *ngIf="scraperForm.get('rut')?.hasError('invalidRut')">
              El RUT ingresado no es válido
            </mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Contraseña</mat-label>
            <input 
              matInput 
              formControlName="password" 
              type="password" 
              placeholder="Tu contraseña del banco">
            <mat-error *ngIf="scraperForm.get('password')?.hasError('required')">
              La contraseña es requerida
            </mat-error>
            <mat-error *ngIf="scraperForm.get('password')?.hasError('minlength')">
              La contraseña debe tener al menos 4 caracteres
            </mat-error>
          </mat-form-field>

          <div class="security-notice">
            <mat-icon color="warn">security</mat-icon>
            <div>
              <strong>Seguridad:</strong> Tus credenciales se usan solo para esta sesión y no se almacenan permanentemente.
            </div>
          </div>
        </form>
      </div>

      <div *ngIf="currentTask && currentTask.status === 'completed'" class="task-results">
        <div class="success-header">
          <mat-icon color="primary">check_circle</mat-icon>
          <h3>¡Scraping Completado!</h3>
        </div>
        
        <div class="results-summary" *ngIf="currentTask.result">
          <div class="result-item">
            <span class="label">Cuentas encontradas:</span>
            <span class="value">{{ currentTask.result.total_cuentas || 0 }}</span>
          </div>
          <div class="result-item">
            <span class="label">Movimientos extraídos:</span>
            <span class="value">{{ currentTask.result.total_movimientos || 0 }}</span>
          </div>
          <div class="result-item">
            <span class="label">Fecha de extracción:</span>
            <span class="value">{{ currentTask.result.fecha_extraccion | date:'medium' }}</span>
          </div>
        </div>

        <div class="completion-actions">
          <button mat-button color="primary" (click)="processResults()">
            <mat-icon>save</mat-icon>
            Guardar en mi cuenta
          </button>
          <button mat-button (click)="startNewScraping()">
            <mat-icon>refresh</mat-icon>
            Nuevo scraping
          </button>
        </div>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button 
        mat-button 
        (click)="closeDialog()" 
        [disabled]="isProcessing">
        Cerrar
      </button>
      <button 
        mat-raised-button 
        color="primary" 
        (click)="startScraping()" 
        [disabled]="!scraperForm.valid || isProcessing || (currentTask && currentTask.status === 'processing')"
        *ngIf="!currentTask || currentTask.status === 'completed'">
        <mat-icon>sync</mat-icon>
        Iniciar Scraping
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .task-progress {
      padding: 20px 0;
      text-align: center;
    }

    .progress-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .progress-percentage {
      font-weight: bold;
      color: #1976d2;
    }

    .progress-actions {
      margin-top: 16px;
    }

    .scraper-form {
      padding: 20px 0;
    }

    .full-width {
      width: 100%;
      margin-bottom: 16px;
    }

    .security-notice {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 16px;
      background-color: #fff3cd;
      border-radius: 4px;
      margin-top: 16px;
      font-size: 14px;
    }

    .task-results {
      padding: 20px 0;
      text-align: center;
    }

    .success-header {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-bottom: 24px;
    }

    .results-summary {
      background-color: #f8f9fa;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 24px;
    }

    .result-item {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e0e0e0;
    }

    .result-item:last-child {
      border-bottom: none;
    }

    .label {
      font-weight: 500;
      color: #666;
    }

    .value {
      font-weight: bold;
      color: #1976d2;
    }

    .completion-actions {
      display: flex;
      gap: 12px;
      justify-content: center;
      flex-wrap: wrap;
    }

    mat-dialog-content {
      min-height: 200px;
      max-height: 500px;
      overflow-y: auto;
    }

    mat-dialog-actions {
      padding: 16px 24px;
    }
  `]
})
export class ScraperDialogComponent implements OnInit, OnDestroy {
  scraperForm: FormGroup;
  currentTask: ScraperTask | null = null;
  isProcessing = false;
  private monitoringSubscription?: Subscription;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<ScraperDialogComponent>,
    private scraperService: ScraperService,
    private snackBar: MatSnackBar,
    private wsService: WebSocketService
  ) {
    this.scraperForm = this.fb.group({
      rut: ['', [Validators.required, this.rutValidator.bind(this)]],
      password: ['', [Validators.required, Validators.minLength(4)]],
      site: ['banco-estado']
    });
  }

  ngOnInit() {
    // Inicialización del componente
  }

  ngOnDestroy() {
    this.stopMonitoring();
    if (this.currentTask?.id) {
      this.wsService.unsubscribeFromTask(this.currentTask.id);
      this.wsService.disconnect();
    }
  }

  rutValidator(control: any) {
    const rut = control.value;
    if (!rut) return null;
    
    const isValid = this.scraperService.validateRut(rut);
    return isValid ? null : { invalidRut: true };
  }

  formatRutField() {
    const rutControl = this.scraperForm.get('rut');
    if (rutControl?.value) {
      const formattedRut = this.scraperService.formatRut(rutControl.value);
      rutControl.setValue(formattedRut);
    }
  }

  startScraping() {
    if (!this.scraperForm.valid || this.isProcessing) return;

    this.isProcessing = true;
    const credentials = this.scraperForm.value;

    this.scraperService.startScraping(credentials).subscribe({
      next: (response) => {
        if (response.success) {
          this.snackBar.open('Scraping iniciado correctamente', 'Cerrar', { duration: 3000 });
          this.startMonitoring(response.data.taskId);
        } else {
          this.snackBar.open('Error al iniciar scraping: ' + response.message, 'Cerrar', { duration: 5000 });
          this.isProcessing = false;
        }
      },
      error: (error) => {
        console.error('Error al iniciar scraping:', error);
        this.snackBar.open('Error al iniciar scraping', 'Cerrar', { duration: 5000 });
        this.isProcessing = false;
      }
    });
  }

  startMonitoring(taskId: string) {
    this.stopMonitoring();
    
    this.monitoringSubscription = this.scraperService.monitorTask(taskId).subscribe({
      next: (task) => {
        this.currentTask = task;
        
        if (['completed', 'failed', 'cancelled'].includes(task.status)) {
          this.isProcessing = false;
          this.stopMonitoring();
          
          if (task.status === 'completed') {
            this.snackBar.open('¡Scraping completado exitosamente!', 'Cerrar', { duration: 3000 });
          } else if (task.status === 'failed') {
            this.snackBar.open('Error en el scraping: ' + (task.error || 'Error desconocido'), 'Cerrar', { duration: 5000 });
          } else {
            this.snackBar.open('Scraping cancelado', 'Cerrar', { duration: 3000 });
          }
        }
      },
      error: (error) => {
        console.error('Error monitoreando tarea:', error);
        this.snackBar.open('Error monitoreando el progreso', 'Cerrar', { duration: 5000 });
        this.isProcessing = false;
      }
    });
  }

  stopMonitoring() {
    if (this.monitoringSubscription) {
      this.monitoringSubscription.unsubscribe();
      this.monitoringSubscription = undefined;
    }
  }

  cancelTask() {
    if (!this.currentTask) return;

    this.scraperService.cancelTask(this.currentTask.id).subscribe({
      next: (response) => {
        if (response.success) {
          this.snackBar.open('Tarea cancelada', 'Cerrar', { duration: 3000 });
        } else {
          this.snackBar.open('Error al cancelar: ' + response.message, 'Cerrar', { duration: 5000 });
        }
      },
      error: (error) => {
        console.error('Error al cancelar tarea:', error);
        this.snackBar.open('Error al cancelar la tarea', 'Cerrar', { duration: 5000 });
      }
    });
  }

  processResults() {
    if (!this.currentTask?.result) return;

    // Aquí puedes implementar la lógica para procesar los resultados
    // Por ejemplo, insertar las cuentas y movimientos en la base de datos
    this.snackBar.open('Procesando resultados... (funcionalidad en desarrollo)', 'Cerrar', { duration: 3000 });
  }

  startNewScraping() {
    this.currentTask = null;
    this.scraperForm.reset();
    this.scraperForm.patchValue({ site: 'banco-estado' });
  }

  closeDialog() {
    this.stopMonitoring();
    if (this.currentTask?.id) {
      this.wsService.unsubscribeFromTask(this.currentTask.id);
      this.wsService.disconnect();
    }
    this.dialogRef.close();
  }
} 