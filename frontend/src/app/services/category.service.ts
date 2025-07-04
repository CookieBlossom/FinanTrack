import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { catchError, map, tap, shareReplay, first } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Category, CategoryExpense } from '../models/category.model';

/**
 * 🔄 SERVICIO DE CATEGORÍAS CON SISTEMA REACTIVO
 * 
 * Implementa cache reactivo para mantener sincronizadas las categorías
 * entre todos los componentes de la aplicación.
 * 
 * CARACTERÍSTICAS:
 * - ✅ Cache reactivo con BehaviorSubject
 * - ✅ Sincronización automática entre componentes
 * - ✅ Eliminación de llamadas HTTP duplicadas
 * - ✅ Observables para estados de carga
 * - ✅ Actualización automática del cache
 */
@Injectable({
  providedIn: 'root'
})
export class CategoryService {
  private apiUrl = `${environment.apiUrl}/categories`;

  // 🔄 Sistema reactivo para mantener sincronizadas las categorías
  private categoriesSubject = new BehaviorSubject<Category[]>([]);
  private categoriesLoaded = false;
  private loadingSubject = new BehaviorSubject<boolean>(false);

  // 📡 Observables públicos para los componentes
  public categories$ = this.categoriesSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable();

  constructor(private http: HttpClient) { }

  // 🔄 Método principal para obtener categorías (reactivo)
  getUserCategories(): Observable<Category[]> {
    // Si ya tenemos datos, devolver el observable
    if (this.categoriesLoaded) {
      return this.categories$;
    }
    return this.loadCategoriesFromServer();
  }

  // 📡 Cargar categorías desde el servidor y actualizar el cache
  private loadCategoriesFromServer(): Observable<Category[]> {
    if (this.loadingSubject.value) {
      // Si ya estamos cargando, devolver el observable actual
      return this.categories$;
    }

    this.loadingSubject.next(true);
    console.log('🌐 [CategoryService] Cargando categorías desde el servidor...');
    
    return this.http.get<Category[]>(`${this.apiUrl}/user`).pipe(
      tap(categories => {
        this.categoriesSubject.next(categories);
        this.categoriesLoaded = true;
        this.loadingSubject.next(false);
        console.log('✅ [CategoryService] Cache actualizado con', categories.length, 'categorías');
      }),
      catchError(error => {
        this.loadingSubject.next(false);
        return this.handleError(error);
      }),
      shareReplay(1)
    );
  }

  // 🔄 Refrescar datos desde el servidor
  refreshCategories(): Observable<Category[]> {
    this.categoriesLoaded = false;
    return this.loadCategoriesFromServer();
  }

  // 📝 Obtener categorías desde el cache (síncrono)
  getCategoriesFromCache(): Category[] {
    return this.categoriesSubject.value;
  }

  // ✏️ Actualizar palabras clave de categoría y actualizar cache
  updateUserCategoryKeywords(categoryId: number, keywords: string[]): Observable<any> {
    return this.http.put(`${this.apiUrl}/${categoryId}/keywords`, { keywords }).pipe(
      tap(() => {
        // Actualizar cache: refrescar las categorías para obtener los cambios
        this.refreshCategories().pipe(first()).subscribe();
        console.log('✏️ [CategoryService] Palabras clave actualizadas para categoría:', categoryId);
      }),
      catchError(this.handleError)
    );
  }

  // ✏️ Actualizar color de categoría y actualizar cache
  updateCategoryColor(id: number, color: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}/color`, { color }).pipe(
      tap(() => {
        // Actualizar cache localmente
        const currentCategories = this.categoriesSubject.value;
        const updatedCategories = currentCategories.map(category => 
          category.id === id ? { ...category, color } : category
        );
        this.categoriesSubject.next(updatedCategories);
        console.log('✏️ [CategoryService] Color actualizado para categoría:', id);
      }),
      catchError(this.handleError)
    );
  }

  // 🗑️ Eliminar categoría y actualizar cache (si se implementa)
  deleteCategory(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => {
        // Actualizar cache eliminando la categoría
        const currentCategories = this.categoriesSubject.value;
        const updatedCategories = currentCategories.filter(category => category.id !== id);
        this.categoriesSubject.next(updatedCategories);
        console.log('🗑️ [CategoryService] Categoría eliminada del cache:', id);
      }),
      catchError(this.handleError)
    );
  }

  // ➕ Crear categoría y actualizar cache (si se implementa)
  createCategory(categoryData: Partial<Category>): Observable<Category> {
    return this.http.post<Category>(this.apiUrl, categoryData).pipe(
      tap(newCategory => {
        // Agregar nueva categoría al cache
        const currentCategories = this.categoriesSubject.value;
        const updatedCategories = [...currentCategories, newCategory];
        this.categoriesSubject.next(updatedCategories);
        console.log('➕ [CategoryService] Nueva categoría agregada al cache:', newCategory.id);
      }),
      catchError(this.handleError)
    );
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