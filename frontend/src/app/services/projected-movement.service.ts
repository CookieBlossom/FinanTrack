import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { 
  ProjectedMovement, 
  ProjectedMovementCreate, 
  ProjectedMovementUpdate, 
  ProjectedMovementFilters 
} from '../models/projected-movement.model';

@Injectable({
  providedIn: 'root'
})
export class ProjectedMovementService {
  private apiUrl = `${environment.apiUrl}/projected-movements`;

  constructor(private http: HttpClient) {}

  // Obtener todos los movimientos proyectados del usuario
  getProjectedMovements(): Observable<ProjectedMovement[]> {
    return this.http.get<ProjectedMovement[]>(this.apiUrl);
  }

  // Obtener un movimiento proyectado por ID
  getProjectedMovementById(id: number): Observable<ProjectedMovement> {
    return this.http.get<ProjectedMovement>(`${this.apiUrl}/${id}`);
  }

  // Obtener movimientos proyectados con filtros
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

    return this.http.get<ProjectedMovement[]>(`${this.apiUrl}/filters?${params.toString()}`);
  }

  // Crear un nuevo movimiento proyectado
  createProjectedMovement(movement: ProjectedMovementCreate): Observable<ProjectedMovement> {
    return this.http.post<ProjectedMovement>(this.apiUrl, movement);
  }

  // Actualizar un movimiento proyectado
  updateProjectedMovement(id: number, movement: ProjectedMovementUpdate): Observable<ProjectedMovement> {
    return this.http.put<ProjectedMovement>(`${this.apiUrl}/${id}`, movement);
  }

  // Eliminar un movimiento proyectado
  deleteProjectedMovement(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }

  // Marcar como completado
  markAsCompleted(id: number, actualMovementId: number): Observable<ProjectedMovement> {
    return this.http.patch<ProjectedMovement>(`${this.apiUrl}/${id}/complete`, { actualMovementId });
  }

  // Marcar como cancelado
  markAsCancelled(id: number): Observable<ProjectedMovement> {
    return this.http.patch<ProjectedMovement>(`${this.apiUrl}/${id}/cancel`, {});
  }
} 