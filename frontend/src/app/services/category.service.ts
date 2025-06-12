import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Category, CategoryExpense } from '../models/category.model';

@Injectable({
  providedIn: 'root'
})
export class CategoryService {
  private apiUrl = `${environment.apiUrl}/categories`;

  constructor(private http: HttpClient) { }


  getUserCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.apiUrl}/user`);
  }

  updateUserCategoryKeywords(categoryId: number, keywords: string[]) {
    return this.http.put(`${this.apiUrl}/${categoryId}/keywords`, { keywords });
  }
  updateCategoryColor(id: number, color: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}/color`, { color });
  }
} 