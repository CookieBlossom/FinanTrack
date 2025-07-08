import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { map, tap, catchError, shareReplay, first } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { 
  ProjectedMovement, 
  ProjectedMovementCreate, 
  ProjectedMovementUpdate, 
  ProjectedMovementFilters 
} from '../models/projected-movement.model';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class ProjectedMovementService {
  private apiUrl = `${environment.apiUrl}/projected-movements`;

  // 🔄 Sistema reactivo para mantener sincronizados los movimientos proyectados
  private projectedMovementsSubject = new BehaviorSubject<ProjectedMovement[]>([]);
  private intelligentMovementsSubject = new BehaviorSubject<ProjectedMovement[]>([]);
  private projectedLoaded = false;
  private intelligentLoaded = false;
  private loadingSubject = new BehaviorSubject<boolean>(false);

  // 📡 Observables públicos para los componentes
  public projectedMovements$ = this.projectedMovementsSubject.asObservable();
  public intelligentMovements$ = this.intelligentMovementsSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable();

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {
    // Suscribirse a cambios en la autenticación
    this.authService.isAuthenticated$.subscribe(isAuthenticated => {
      if (!isAuthenticated) {
        this.clearCache();
      }
    });
  }
  clearCache(): void {
    this.projectedMovementsSubject.next([]);
    this.intelligentMovementsSubject.next([]);
    this.projectedLoaded = false;
    this.intelligentLoaded = false;
    this.loadingSubject.next(false);
    console.log('🧹 [ProjectedMovementService] Cache limpiado');
  }

  // 🔄 Obtener todos los movimientos proyectados (reactivo)
  getProjectedMovements(): Observable<ProjectedMovement[]> {
    if (this.projectedLoaded) {
      return this.projectedMovements$;
    }
    return this.loadProjectedMovementsFromServer();
  }

  // 🔄 Obtener movimientos proyectados inteligentes (reactivo)
  getIntelligentProjectedMovements(): Observable<ProjectedMovement[]> {
    if (this.intelligentLoaded) {
      return this.intelligentMovements$;
    }
    return this.loadIntelligentMovementsFromServer();
  }

  // 📡 Cargar movimientos proyectados desde el servidor
  private loadProjectedMovementsFromServer(): Observable<ProjectedMovement[]> {
    if (this.loadingSubject.value) {
      return this.projectedMovements$;
    }

    this.loadingSubject.next(true);
    console.log('🌐 [ProjectedMovementService] Cargando movimientos proyectados desde el servidor...');
    
    return this.http.get<ProjectedMovement[]>(this.apiUrl).pipe(
      map(movements => movements.map(this.normalizeMovement)),
      tap(movements => {
        this.projectedMovementsSubject.next(movements);
        this.projectedLoaded = true;
        this.loadingSubject.next(false);
        console.log(`✅ [ProjectedMovementService] Cache actualizado con ${movements.length} movimientos proyectados`);
      }),
      catchError(error => {
        this.loadingSubject.next(false);
        return this.handleError(error);
      }),
      shareReplay(1)
    );
  }

  // 📡 Cargar movimientos inteligentes desde el servidor
  private loadIntelligentMovementsFromServer(): Observable<ProjectedMovement[]> {
    if (this.loadingSubject.value) {
      return this.intelligentMovements$;
    }

    this.loadingSubject.next(true);
    console.log('🌐 [ProjectedMovementService] Cargando movimientos inteligentes desde el servidor...');
    
    return this.http.get<ProjectedMovement[]>(`${this.apiUrl}/intelligent`).pipe(
      map(movements => movements.map(this.normalizeMovement)),
      tap(movements => {
        this.intelligentMovementsSubject.next(movements);
        this.intelligentLoaded = true;
        this.loadingSubject.next(false);
        console.log(`✅ [ProjectedMovementService] Cache actualizado con ${movements.length} movimientos inteligentes`);
      }),
      catchError(error => {
        this.loadingSubject.next(false);
        return this.handleError(error);
      }),
      shareReplay(1)
    );
  }

  // 🔍 Obtener movimiento proyectado por ID
  getProjectedMovementById(id: number): Observable<ProjectedMovement> {
    // Primero intentar desde el cache
    const cachedMovement = this.projectedMovementsSubject.value.find(movement => movement.id === id);
    if (cachedMovement) {
      return new Observable(subscriber => {
        subscriber.next(cachedMovement);
        subscriber.complete();
      });
    }

    // Si no está en cache, obtener desde el servidor
    return this.http.get<ProjectedMovement>(`${this.apiUrl}/${id}`).pipe(
      map(this.normalizeMovement),
      tap(movement => {
        // Actualizar el cache con el movimiento obtenido
        const currentMovements = this.projectedMovementsSubject.value;
        const updatedMovements = currentMovements.map(m => m.id === movement.id ? movement : m);
        if (!currentMovements.find(m => m.id === movement.id)) {
          updatedMovements.push(movement);
        }
        this.projectedMovementsSubject.next(updatedMovements);
      }),
      catchError(this.handleError)
    );
  }

  // ➕ Crear movimiento proyectado y actualizar cache
  createProjectedMovement(movement: ProjectedMovementCreate): Observable<ProjectedMovement> {
    return this.http.post<ProjectedMovement>(this.apiUrl, movement).pipe(
      map(this.normalizeMovement),
      tap(newMovement => {
        // Agregar nuevo movimiento al cache
        const currentMovements = this.projectedMovementsSubject.value;
        const updatedMovements = [newMovement, ...currentMovements];
        this.projectedMovementsSubject.next(updatedMovements);
        console.log('➕ [ProjectedMovementService] Nuevo movimiento agregado al cache:', newMovement.id);
      }),
      catchError(this.handleError)
    );
  }

  // ✏️ Actualizar movimiento proyectado y actualizar cache
  updateProjectedMovement(id: number, movement: ProjectedMovementUpdate): Observable<ProjectedMovement> {
    return this.http.put<ProjectedMovement>(`${this.apiUrl}/${id}`, movement).pipe(
      map(this.normalizeMovement),
      tap(updatedMovement => {
        // Actualizar cache con el movimiento actualizado
        const currentMovements = this.projectedMovementsSubject.value;
        const updatedMovements = currentMovements.map(m => 
          m.id === updatedMovement.id ? updatedMovement : m
        );
        this.projectedMovementsSubject.next(updatedMovements);
        console.log('✏️ [ProjectedMovementService] Movimiento actualizado en cache:', updatedMovement.id);
      }),
      catchError(this.handleError)
    );
  }

  // 🗑️ Eliminar movimiento proyectado y actualizar cache
  deleteProjectedMovement(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`).pipe(
      tap(() => {
        // Actualizar cache eliminando el movimiento
        const currentMovements = this.projectedMovementsSubject.value;
        const updatedMovements = currentMovements.filter(movement => movement.id !== id);
        this.projectedMovementsSubject.next(updatedMovements);
        console.log('🗑️ [ProjectedMovementService] Movimiento eliminado del cache:', id);
      }),
      catchError(this.handleError)
    );
  }

  // ✅ Marcar como completado y actualizar cache
  markAsCompleted(id: number, actualMovementId: number): Observable<ProjectedMovement> {
    return this.http.patch<ProjectedMovement>(`${this.apiUrl}/${id}/complete`, { actualMovementId }).pipe(
      map(this.normalizeMovement),
      tap(updatedMovement => {
        // Actualizar cache con el movimiento completado
        const currentMovements = this.projectedMovementsSubject.value;
        const updatedMovements = currentMovements.map(m => 
          m.id === updatedMovement.id ? updatedMovement : m
        );
        this.projectedMovementsSubject.next(updatedMovements);
        console.log('✅ [ProjectedMovementService] Movimiento marcado como completado:', updatedMovement.id);
      }),
      catchError(this.handleError)
    );
  }

  // ❌ Marcar como cancelado y actualizar cache
  markAsCancelled(id: number): Observable<ProjectedMovement> {
    return this.http.patch<ProjectedMovement>(`${this.apiUrl}/${id}/cancel`, {}).pipe(
      map(this.normalizeMovement),
      tap(updatedMovement => {
        // Actualizar cache con el movimiento cancelado
        const currentMovements = this.projectedMovementsSubject.value;
        const updatedMovements = currentMovements.map(m => 
          m.id === updatedMovement.id ? updatedMovement : m
        );
        this.projectedMovementsSubject.next(updatedMovements);
        console.log('❌ [ProjectedMovementService] Movimiento marcado como cancelado:', updatedMovement.id);
      }),
      catchError(this.handleError)
    );
  }

  // 🔄 Métodos para refrescar datos
  refreshProjectedMovements(): Observable<ProjectedMovement[]> {
    this.projectedLoaded = false;
    return this.loadProjectedMovementsFromServer();
  }

  refreshIntelligentMovements(): Observable<ProjectedMovement[]> {
    this.intelligentLoaded = false;
    return this.loadIntelligentMovementsFromServer();
  }

  // 📝 Obtener movimientos desde el cache (síncrono)
  getProjectedMovementsFromCache(): ProjectedMovement[] {
    return this.projectedMovementsSubject.value;
  }

  getIntelligentMovementsFromCache(): ProjectedMovement[] {
    return this.intelligentMovementsSubject.value;
  }

  // 📊 Obtener movimientos proyectados con filtros (sin cache, consulta específica)
  getProjectedMovementsByFilters(filters: ProjectedMovementFilters): Observable<ProjectedMovement[]> {
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (value instanceof Date) {
          params.append(key, value.toISOString());
        } else {
          params.append(key, value.toString());
        }
      }
    });

    return this.http.get<ProjectedMovement[]>(`${this.apiUrl}/filters?${params.toString()}`).pipe(
      map(movements => movements.map(this.normalizeMovement)),
      catchError(this.handleError)
    );
  }

  // 📝 Método privado para normalizar los datos del movimiento
  private normalizeMovement = (movement: any): ProjectedMovement => {
    return {
      ...movement,
      amount: typeof movement.amount === 'string' ? parseFloat(movement.amount) : movement.amount,
      expectedDate: new Date(movement.expectedDate),
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
      this.clearCache(); // Limpiar caché en caso de error de autorización
      this.authService.logout(); // Cerrar sesión automáticamente
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