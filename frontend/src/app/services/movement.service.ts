import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { catchError, map, tap, shareReplay, first } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Movement, MovementCreate, MovementFilters } from '../models/movement.model';

/**
 * 🔄 SERVICIO DE MOVIMIENTOS CON SISTEMA REACTIVO
 * 
 * Implementa cache reactivo para mantener sincronizados los movimientos
 * entre todos los componentes de la aplicación.
 * 
 * CARACTERÍSTICAS:
 * - ✅ Cache reactivo con BehaviorSubject por tipo de movimiento
 * - ✅ Sincronización automática entre componentes
 * - ✅ Eliminación de llamadas HTTP duplicadas
 * - ✅ Observables para estados de carga
 * - ✅ Actualización automática del cache
 */
@Injectable({
  providedIn: 'root'
})
export class MovementService {
  private apiUrl = `${environment.apiUrl}/movements`;
  private manualMovementsSubject = new BehaviorSubject<Movement[]>([]);
  private scraperMovementsSubject = new BehaviorSubject<Movement[]>([]);
  private cartolaMovementsSubject = new BehaviorSubject<Movement[]>([]);
  private cardMovementsSubject = new BehaviorSubject<Movement[]>([]);
  private cashMovementsSubject = new BehaviorSubject<Movement[]>([]);
  
  // Estados de carga por tipo
  private manualLoaded = false;
  private scraperLoaded = false;
  private cartolaLoaded = false;
  private cardLoaded = false;
  private cashLoaded = false;
  private loadingSubject = new BehaviorSubject<boolean>(false);

  // 📡 Observables públicos para los componentes
  public manualMovements$ = this.manualMovementsSubject.asObservable();
  public scraperMovements$ = this.scraperMovementsSubject.asObservable();
  public cartolaMovements$ = this.cartolaMovementsSubject.asObservable();
  public cardMovements$ = this.cardMovementsSubject.asObservable();
  public cashMovements$ = this.cashMovementsSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable();

  constructor(private http: HttpClient) {}
  getMovements(source: 'manual' | 'scraper' | 'cartola'): Observable<Movement[]> {
    switch (source) {
      case 'manual':
        return this.manualLoaded ? this.manualMovements$ : this.loadMovementsFromServer(source);
      case 'scraper':
        return this.scraperLoaded ? this.scraperMovements$ : this.loadMovementsFromServer(source);
      case 'cartola':
        return this.cartolaLoaded ? this.cartolaMovements$ : this.loadMovementsFromServer(source);
      default:
        return this.loadMovementsFromServer(source);
    }
  }

  // 🔄 Obtener movimientos de tarjetas (reactivo)
  getCardMovements(): Observable<Movement[]> {
    if (this.cardLoaded) {
      return this.cardMovements$;
    }
    return this.loadCardMovementsFromServer();
  }

  // 🔄 Obtener movimientos de efectivo (reactivo)
  getCashMovements(): Observable<Movement[]> {
    if (this.cashLoaded) {
      return this.cashMovements$;
    }
    return this.loadCashMovementsFromServer();
  }

  // 📡 Cargar movimientos desde el servidor por fuente
  private loadMovementsFromServer(source: 'manual' | 'scraper' | 'cartola'): Observable<Movement[]> {
    if (this.loadingSubject.value) {
      return this.getMovementObservable(source);
    }

    this.loadingSubject.next(true);
    console.log(`🌐 [MovementService] Cargando movimientos ${source} desde el servidor...`);
    
    return this.http.get<Movement[]>(`${this.apiUrl}?movementSource=${source}`).pipe(
      map(movements => movements.map(this.normalizeMovement)),
      tap(movements => {
        this.updateMovementCache(source, movements);
        this.setLoadedState(source, true);
        this.loadingSubject.next(false);
        console.log(`✅ [MovementService] Cache actualizado con ${movements.length} movimientos ${source}`);
      }),
      catchError(error => {
        this.loadingSubject.next(false);
        return this.handleError(error);
      }),
      shareReplay(1)
    );
  }

  // 📡 Cargar movimientos de tarjetas desde el servidor
  private loadCardMovementsFromServer(): Observable<Movement[]> {
    this.loadingSubject.next(true);
    console.log('🌐 [MovementService] Cargando movimientos de tarjetas desde el servidor...');
    
    return this.http.get<Movement[]>(`${this.apiUrl}/card-movements`).pipe(
      map(movements => movements.map(this.normalizeMovement)),
      tap(movements => {
        this.cardMovementsSubject.next(movements);
        this.cardLoaded = true;
        this.loadingSubject.next(false);
        console.log(`✅ [MovementService] Cache actualizado con ${movements.length} movimientos de tarjetas`);
      }),
      catchError(error => {
        this.loadingSubject.next(false);
        return this.handleError(error);
      }),
      shareReplay(1)
    );
  }

  // 📡 Cargar movimientos de efectivo desde el servidor
  private loadCashMovementsFromServer(): Observable<Movement[]> {
    this.loadingSubject.next(true);
    console.log('🌐 [MovementService] Cargando movimientos de efectivo desde el servidor...');
    
    return this.http.get<Movement[]>(`${this.apiUrl}/cash`).pipe(
      map(movements => movements.map(this.normalizeMovement)),
      tap(movements => {
        this.cashMovementsSubject.next(movements);
        this.cashLoaded = true;
        this.loadingSubject.next(false);
        console.log(`✅ [MovementService] Cache actualizado con ${movements.length} movimientos de efectivo`);
      }),
      catchError(error => {
        this.loadingSubject.next(false);
        return this.handleError(error);
      }),
      shareReplay(1)
    );
  }

  // ➕ Agregar movimiento y actualizar cache
  addMovement(movement: MovementCreate): Observable<Movement> {
    const movementData = {
      ...movement,
      movementSource: 'manual'
    };
    
    return this.http.post<Movement>(this.apiUrl, movementData).pipe(
      map(this.normalizeMovement),
      tap(newMovement => {
        // Agregar al cache de movimientos manuales
        const currentMovements = this.manualMovementsSubject.value;
        const updatedMovements = [newMovement, ...currentMovements];
        this.manualMovementsSubject.next(updatedMovements);
        
        // También actualizar el cache de movimientos de tarjetas si corresponde
        this.refreshCardMovementsCache();
        
        console.log('➕ [MovementService] Nuevo movimiento agregado al cache:', newMovement.id);
      }),
      catchError(this.handleError)
    );
  }

  // ✏️ Actualizar movimiento y actualizar cache
  updateMovement(id: number, movement: Partial<Movement>): Observable<Movement> {
    return this.http.put<Movement>(`${this.apiUrl}/${id}`, movement).pipe(
      map(this.normalizeMovement),
      tap(updatedMovement => {
        // Actualizar en todos los caches relevantes
        this.updateMovementInAllCaches(updatedMovement);
        console.log('✏️ [MovementService] Movimiento actualizado en cache:', updatedMovement.id);
      }),
      catchError(this.handleError)
    );
  }

  // 🗑️ Eliminar movimiento y actualizar cache
  deleteMovement(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => {
        // Eliminar de todos los caches
        this.removeMovementFromAllCaches(id);
        console.log('🗑️ [MovementService] Movimiento eliminado del cache:', id);
      }),
      catchError(this.handleError)
    );
  }

  // 🔄 Métodos para refrescar datos
  refreshMovements(source: 'manual' | 'scraper' | 'cartola'): Observable<Movement[]> {
    this.setLoadedState(source, false);
    return this.loadMovementsFromServer(source);
  }

  refreshCardMovements(): Observable<Movement[]> {
    this.cardLoaded = false;
    return this.loadCardMovementsFromServer();
  }

  refreshCashMovements(): Observable<Movement[]> {
    this.cashLoaded = false;
    return this.loadCashMovementsFromServer();
  }

  // 📊 Métodos adicionales (sin cache por ahora, ya que suelen ser consultas específicas)
  getFilteredMovements(filters: MovementFilters): Observable<Movement[]> {
    return this.http.post<Movement[]>(`${this.apiUrl}/filter`, filters).pipe(
      map(movements => movements.map(this.normalizeMovement)),
      catchError(this.handleError)
    );
  }

  uploadCartola(formData: FormData): Observable<any> {
    return this.http.post(`${this.apiUrl}/cartola`, formData).pipe(
      tap(() => {
        // Después de subir cartola, refrescar movimientos de cartola
        this.refreshMovements('cartola').pipe(first()).subscribe();
        this.refreshCardMovements().pipe(first()).subscribe();
      }),
      catchError(this.handleError)
    );
  }

  getMonthlySummary(month: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/monthly-summary?month=${month}`).pipe(
      catchError(this.handleError)
    );
  }

  // 🔧 Métodos auxiliares
  private getMovementObservable(source: 'manual' | 'scraper' | 'cartola'): Observable<Movement[]> {
    switch (source) {
      case 'manual': return this.manualMovements$;
      case 'scraper': return this.scraperMovements$;
      case 'cartola': return this.cartolaMovements$;
      default: return this.manualMovements$;
    }
  }

  private updateMovementCache(source: 'manual' | 'scraper' | 'cartola', movements: Movement[]): void {
    switch (source) {
      case 'manual':
        this.manualMovementsSubject.next(movements);
        break;
      case 'scraper':
        this.scraperMovementsSubject.next(movements);
        break;
      case 'cartola':
        this.cartolaMovementsSubject.next(movements);
        break;
    }
  }

  private setLoadedState(source: 'manual' | 'scraper' | 'cartola', loaded: boolean): void {
    switch (source) {
      case 'manual': this.manualLoaded = loaded; break;
      case 'scraper': this.scraperLoaded = loaded; break;
      case 'cartola': this.cartolaLoaded = loaded; break;
    }
  }

  private updateMovementInAllCaches(updatedMovement: Movement): void {
    // Actualizar en cache manual
    this.updateMovementInCache(this.manualMovementsSubject, updatedMovement);
    // Actualizar en cache scraper
    this.updateMovementInCache(this.scraperMovementsSubject, updatedMovement);
    // Actualizar en cache cartola
    this.updateMovementInCache(this.cartolaMovementsSubject, updatedMovement);
    // Actualizar en cache de tarjetas
    this.updateMovementInCache(this.cardMovementsSubject, updatedMovement);
    // Actualizar en cache de efectivo
    this.updateMovementInCache(this.cashMovementsSubject, updatedMovement);
  }

  private updateMovementInCache(subject: BehaviorSubject<Movement[]>, updatedMovement: Movement): void {
    const currentMovements = subject.value;
    const updatedMovements = currentMovements.map(movement => 
      movement.id === updatedMovement.id ? updatedMovement : movement
    );
    subject.next(updatedMovements);
  }

  private removeMovementFromAllCaches(id: number): void {
    // Eliminar de todos los caches
    this.removeMovementFromCache(this.manualMovementsSubject, id);
    this.removeMovementFromCache(this.scraperMovementsSubject, id);
    this.removeMovementFromCache(this.cartolaMovementsSubject, id);
    this.removeMovementFromCache(this.cardMovementsSubject, id);
    this.removeMovementFromCache(this.cashMovementsSubject, id);
  }

  private removeMovementFromCache(subject: BehaviorSubject<Movement[]>, id: number): void {
    const currentMovements = subject.value;
    const updatedMovements = currentMovements.filter(movement => movement.id !== id);
    subject.next(updatedMovements);
  }

  private refreshCardMovementsCache(): void {
    if (this.cardLoaded) {
      this.refreshCardMovements().pipe(first()).subscribe();
    }
  }

  // 📝 Normalizar movimiento
  private normalizeMovement = (movement: any): Movement => {
    return {
      ...movement,
      amount: typeof movement.amount === 'string' ? parseFloat(movement.amount) : movement.amount,
      transactionDate: movement.transactionDate ? new Date(movement.transactionDate) : undefined,
      createdAt: movement.createdAt ? new Date(movement.createdAt) : undefined,
      updatedAt: movement.updatedAt ? new Date(movement.updatedAt) : undefined
    };
  }

  private handleError(error: any) {
    let errorMessage = 'Ocurrió un error en el servidor.';
    if (error.error instanceof ErrorEvent) {
      errorMessage = error.error.message;
    } else if (error.status === 0) {
      errorMessage = 'No se pudo conectar con el servidor. Por favor, verifica tu conexión a internet.';
    } else if (error.status === 401) {
      errorMessage = 'No autorizado. Por favor, inicia sesión nuevamente.';
    } else if (error.status === 403) {
      errorMessage = 'No tienes permisos para realizar esta acción.';
    } else if (error.status === 404) {
      errorMessage = 'El recurso solicitado no existe.';
    } else if (typeof error.error === 'string') {
      errorMessage = error.error;
    } else if (error.error?.message) {
      errorMessage = error.error.message;
    } else if (error.message) {
      errorMessage = error.message;
    }
  
    return throwError(() => new Error(errorMessage));
  }
} 