import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ScraperService, ScraperTask } from '../../services/scraper.service';
import { Subscription } from 'rxjs';
import { WebSocketService } from '../../services/websocket.service';

@Component({
  selector: 'app-scraper-dialog',
  template: `
    <h2 mat-dialog-title>
      <mat-icon>sync</mat-icon>
      Scraper Automático - Banco Estado
    </h2>

    <mat-dialog-content>
      <div *ngIf="currentTask && currentTask.status !== 'completed' && currentTask.status !== 'failed'" class="task-progress">
        <div class="progress-header">
          <h3>{{ currentTask.message }}</h3>
          <span class="progress-percentage" [class.warning]="currentTask.status === 'cancelling'">
            {{ currentTask.progress }}%
          </span>
        </div>
        
        <div class="progress-bar-container">
          <mat-progress-bar 
            [value]="currentTask.progress" 
            [mode]="currentTask.status === 'processing' ? 'determinate' : 'indeterminate'"
            [color]="getProgressBarColor()">
          </mat-progress-bar>
          
          <div class="progress-steps" *ngIf="currentTask.status === 'processing'">
            <div class="step" [class.completed]="currentTask.progress >= 25">
              <div class="step-marker">1</div>
              <div class="step-label">Conexión</div>
            </div>
            <div class="step" [class.completed]="currentTask.progress >= 50">
              <div class="step-marker">2</div>
              <div class="step-label">Extracción</div>
            </div>
            <div class="step" [class.completed]="currentTask.progress >= 75">
              <div class="step-marker">3</div>
              <div class="step-label">Procesamiento</div>
            </div>
            <div class="step" [class.completed]="currentTask.progress >= 100">
              <div class="step-marker">4</div>
              <div class="step-label">Finalización</div>
            </div>
          </div>
        </div>
        
        <div class="progress-actions">
          <button 
            mat-button 
            color="warn" 
            (click)="cancelTask()" 
            [disabled]="currentTask.status === 'cancelling'">
            <mat-icon>stop</mat-icon>
            {{ currentTask.status === 'cancelling' ? 'Cancelando...' : 'Cancelar' }}
          </button>
        </div>

        <div class="progress-status" *ngIf="currentTask.result?.stats">
          <div class="status-item">
            <span class="label">Cuentas procesadas:</span>
            <span class="value">{{ currentTask.result.stats.cuentas_procesadas?.length || 0 }}</span>
          </div>
          <div class="status-item">
            <span class="label">Movimientos procesados:</span>
            <span class="value">{{ currentTask.result.stats.exitosos || 0 }} / {{ currentTask.result.stats.total_procesados || 0 }}</span>
          </div>
        </div>
      </div>

      <div *ngIf="currentTask?.status === 'failed'" class="error-container">
        <div class="error-header">
          <mat-icon color="warn">error</mat-icon>
          <h3>Error en el Scraping</h3>
        </div>
        
        <div class="error-message">
          {{ currentTask.message }}
          <div *ngIf="currentTask.error" class="error-detail">
            {{ currentTask.error }}
          </div>
        </div>

        <div class="error-actions">
          <button mat-button color="primary" (click)="startNewScraping()">
            <mat-icon>refresh</mat-icon>
            Intentar de nuevo
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
        *ngIf="!currentTask || currentTask.status === 'completed' || currentTask.status === 'failed'">
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

    .error-container {
      padding: 20px;
      background-color: #fdecea;
      border-radius: 8px;
      margin: 16px 0;
    }

    .error-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 16px;
    }

    .error-header h3 {
      margin: 0;
      color: #d32f2f;
    }

    .error-message {
      color: #d32f2f;
      margin-bottom: 16px;
      white-space: pre-line;
    }

    .error-detail {
      margin-top: 8px;
      font-size: 0.9em;
      color: #666;
    }

    .error-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
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

    :host ::ng-deep .error-snackbar {
      background-color: #d32f2f;
      color: white;
    }

    :host ::ng-deep .error-snackbar .mat-simple-snackbar-action {
      color: white;
    }

    .progress-bar-container {
      position: relative;
      margin: 30px 0;
    }

    .progress-steps {
      display: flex;
      justify-content: space-between;
      margin-top: 20px;
      padding: 0 10px;
    }

    .step {
      display: flex;
      flex-direction: column;
      align-items: center;
      flex: 1;
      position: relative;
      color: #9e9e9e;
    }

    .step.completed {
      color: #1976d2;
    }

    .step-marker {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background-color: #e0e0e0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: bold;
      margin-bottom: 8px;
      transition: all 0.3s ease;
    }

    .step.completed .step-marker {
      background-color: #1976d2;
      color: white;
    }

    .step-label {
      font-size: 12px;
      text-align: center;
    }

    .progress-percentage {
      font-weight: bold;
      color: #1976d2;
      font-size: 18px;
      transition: color 0.3s ease;
    }

    .progress-percentage.warning {
      color: #f44336;
    }

    .progress-status {
      margin-top: 20px;
      padding: 15px;
      background-color: #f5f5f5;
      border-radius: 8px;
    }

    .status-item {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e0e0e0;
    }

    .status-item:last-child {
      border-bottom: none;
    }

    .status-item .label {
      color: #666;
      font-weight: 500;
    }

    .status-item .value {
      color: #1976d2;
      font-weight: bold;
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
    this.wsService.connect();
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
    this.scraperForm.disable();
    const credentials = this.scraperForm.value;

    this.scraperService.startScraping(credentials).subscribe({
      next: (response) => {
        if (response.success) {
          this.snackBar.open('Scraping iniciado correctamente', 'Cerrar', { duration: 3000 });
          this.startMonitoring(response.data.taskId);
        } else {
          this.snackBar.open('Error al iniciar scraping: ' + response.message, 'Cerrar', { 
            duration: 5000,
            panelClass: ['error-snackbar']
          });
          this.isProcessing = false;
          this.scraperForm.enable();
        }
      },
      error: (error) => {
        this.snackBar.open('Error al iniciar scraping', 'Cerrar', { 
          duration: 5000,
          panelClass: ['error-snackbar']
        });
        this.isProcessing = false;
        this.scraperForm.enable();
      }
    });
  }

  startMonitoring(taskId: string) {
    this.stopMonitoring();
    
    // Primero obtener el estado actual
    this.scraperService.getTaskStatus(taskId).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.currentTask = response.data;
          
          // Si la tarea ya está en estado final, no iniciar monitoreo
          if (['completed', 'failed', 'cancelled'].includes(response.data.status)) {
            this.handleTaskCompletion(response.data);
            return;
          }
          
          // Iniciar monitoreo solo si la tarea no está en estado final
          this.monitoringSubscription = this.scraperService.monitorTask(taskId).subscribe({
            next: (task) => {
              this.currentTask = task;
              
              // Verificar si la tarea ha alcanzado un estado final
              if (['completed', 'failed', 'cancelled'].includes(task.status)) {
                this.handleTaskCompletion(task);
              }
            },
            error: (error) => {
              this.snackBar.open('Error al monitorear la tarea', 'Cerrar', {
                duration: 5000,
                panelClass: ['error-snackbar']
              });
              this.handleTaskError(error);
            }
          });
        } else {
          this.snackBar.open('Error al obtener estado de la tarea', 'Cerrar', {
            duration: 5000,
            panelClass: ['error-snackbar']
          });
          this.handleTaskError(new Error('No se pudo obtener el estado inicial'));
        }
      },
      error: (error) => {
        this.snackBar.open('Error al obtener estado de la tarea', 'Cerrar', {
          duration: 5000,
          panelClass: ['error-snackbar']
        });
        this.handleTaskError(error);
      }
    });
  }

  private handleTaskCompletion(task: ScraperTask) {
    // Detener el monitoreo
    this.stopMonitoring();
    
    // Actualizar UI
    this.isProcessing = false;
    this.scraperForm.enable();
    
    // Mostrar mensaje según el estado
    let message = '';
    let panelClass = '';
    
    switch (task.status) {
      case 'completed':
        message = 'Scraping completado exitosamente';
        panelClass = 'success-snackbar';
        break;
      case 'failed':
        message = `Error en el scraping: ${task.error || task.message}`;
        panelClass = 'error-snackbar';
        break;
      case 'cancelled':
        message = 'Scraping cancelado';
        panelClass = 'warning-snackbar';
        break;
    }
    
    this.snackBar.open(message, 'Cerrar', {
      duration: 5000,
      panelClass: [panelClass]
    });
    
    // Desuscribirse del WebSocket
    if (task.id) {
      this.wsService.unsubscribeFromTask(task.id);
    }
  }

  private handleTaskError(error: any) {
    // Detener el monitoreo
    this.stopMonitoring();
    
    // Actualizar UI
    this.isProcessing = false;
    this.scraperForm.enable();
    
    // Actualizar estado de la tarea
    if (this.currentTask) {
      // Crear una nueva tarea con todos los campos requeridos
      this.currentTask = {
        id: this.currentTask.id,
        userId: this.currentTask.userId,
        type: this.currentTask.type,
        status: 'failed',
        message: 'Error en el scraping',
        progress: this.currentTask.progress,
        createdAt: this.currentTask.createdAt,
        updatedAt: new Date().toISOString(),
        error: error.message || 'Error desconocido'
      };
    }
    
    // Desuscribirse del WebSocket si hay una tarea activa
    if (this.currentTask?.id) {
      this.wsService.unsubscribeFromTask(this.currentTask.id);
    }
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
          this.snackBar.open('Error al cancelar: ' + response.message, 'Cerrar', { 
            duration: 5000,
            panelClass: ['error-snackbar']
          });
        }
      },
      error: (error) => {
        this.snackBar.open('Error al cancelar la tarea', 'Cerrar', { 
          duration: 5000,
          panelClass: ['error-snackbar']
        });
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
    this.isProcessing = false;
    this.scraperForm.enable();
    this.scraperForm.reset({
      site: 'banco-estado'
    });
  }

  closeDialog() {
    this.stopMonitoring();
    if (this.currentTask?.id) {
      this.wsService.unsubscribeFromTask(this.currentTask.id);
      this.wsService.disconnect();
    }
    this.dialogRef.close();
  }

  getProgressBarColor(): 'primary' | 'warn' | 'accent' {
    if (this.currentTask) {
      if (this.currentTask.status === 'cancelling') return 'warn';
      if (this.currentTask.status === 'processing') {
        if (this.currentTask.progress < 50) return 'accent';
        return 'primary';
      }
    }
    return 'primary';
  }
} 