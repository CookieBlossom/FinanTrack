import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { CategoryService } from './category.service';
import { Category } from '../models/category.model';

export interface CategorizationResult {
  found: boolean;
  category: Category | null;
  matchedKeywords: string[];
  confidence: number;
}

@Injectable({
  providedIn: 'root'
})
export class CategorizationService {
  private categories: Category[] = [];
  private categoriesLoaded = false;

  constructor(private categoryService: CategoryService) {}

  /**
   * Carga las categorías del usuario si no están cargadas
   */
  private loadCategories(): Observable<Category[]> {
    if (this.categoriesLoaded && this.categories.length > 0) {
      return of(this.categories);
    }

    return this.categoryService.getUserCategories().pipe(
      map(categories => {
        this.categories = categories;
        this.categoriesLoaded = true;
        return categories;
      })
    );
  }
  private normalizeText(text: string): string {
    return text
      .toUpperCase()
      .trim()
      .replace(/\s+/g, ' ')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  /**
   * Categoriza una descripción basándose en las palabras clave del usuario
   */
  categorizeDescription(description: string): Observable<CategorizationResult> {
    if (!description || description.trim().length === 0) {
      return of({
        found: false,
        category: null,
        matchedKeywords: [],
        confidence: 0
      });
    }

    return this.loadCategories().pipe(
      map(categories => {
        const normalizedDescription = this.normalizeText(description);
        let bestMatch: CategorizationResult = {
          found: false,
          category: null,
          matchedKeywords: [],
          confidence: 0
        };

        // Buscar coincidencias en todas las categorías
        for (const category of categories) {
          if (category.keywords && Array.isArray(category.keywords) && category.keywords.length > 0) {
            const matchedKeywords: string[] = [];
            let totalMatchLength = 0;

            for (const keyword of category.keywords) {
              const normalizedKeyword = this.normalizeText(keyword);
              
              if (normalizedKeyword && normalizedDescription.includes(normalizedKeyword)) {
                matchedKeywords.push(keyword);
                totalMatchLength += normalizedKeyword.length;
              }
            }

            if (matchedKeywords.length > 0) {
              // Calcular confianza basada en:
              // - Número de palabras clave que coinciden
              // - Longitud total de las coincidencias
              // - Longitud de la descripción
              const confidence = Math.min(
                (matchedKeywords.length * 0.3) + 
                (totalMatchLength / normalizedDescription.length * 0.7),
                1.0
              );

              // Si esta coincidencia es mejor que la anterior, la guardamos
              if (confidence > bestMatch.confidence) {
                bestMatch = {
                  found: true,
                  category: category,
                  matchedKeywords: matchedKeywords,
                  confidence: confidence
                };
              }
            }
          }
        }

        return bestMatch;
      })
    );
  }

  /**
   * Recarga las categorías (útil cuando se actualizan las palabras clave)
   */
  reloadCategories(): void {
    this.categoriesLoaded = false;
    this.categories = [];
  }

  /**
   * Obtiene sugerencias de categorías basadas en una descripción parcial
   */
  getSuggestions(partialDescription: string): Observable<Category[]> {
    if (!partialDescription || partialDescription.trim().length < 2) {
      return of([]);
    }

    return this.loadCategories().pipe(
      map(categories => {
        const normalizedInput = this.normalizeText(partialDescription);
        const suggestions: { category: Category; relevance: number }[] = [];

        for (const category of categories) {
          if (category.keywords && Array.isArray(category.keywords)) {
            let relevance = 0;

            for (const keyword of category.keywords) {
              const normalizedKeyword = this.normalizeText(keyword);
              
              if (normalizedKeyword.includes(normalizedInput) || 
                  normalizedInput.includes(normalizedKeyword)) {
                relevance += normalizedKeyword.length / normalizedInput.length;
              }
            }

            if (relevance > 0) {
              suggestions.push({ category, relevance });
            }
          }
        }

        // Ordenar por relevancia y devolver solo las categorías
        return suggestions
          .sort((a, b) => b.relevance - a.relevance)
          .slice(0, 5) // Top 5 sugerencias
          .map(s => s.category);
      })
    );
  }
} 