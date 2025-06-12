import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { ScraperService } from './scraper.service';
import { Card, CardCredentials, CardType, Bank } from '../models/card.model';

@Injectable({
  providedIn: 'root'
})
export class CardService {
  private apiUrl = `${environment.apiUrl}/cards`;
  private cartolasUrl = `${environment.apiUrl}/cartolas`;
  private cardTypesUrl = `${environment.apiUrl}/card-types`;
  private banksUrl = `${environment.apiUrl}/banks`;

  constructor(
    private http: HttpClient,
    private scraperService: ScraperService
  ) {}

  private transformCard(card: Card): Card {
    return {
      ...card,
      balance: card.balance !== undefined && card.balance !== null
        ? Number(card.balance)
        : 0,
      createdAt: card.createdAt ? new Date(card.createdAt) : undefined,
      updatedAt: card.updatedAt ? new Date(card.updatedAt) : undefined
    };
  }

  getCards(): Observable<Card[]> {
    return this.http.get<Card[]>(this.apiUrl).pipe(
      map(cards => cards.map(card => this.transformCard(card))),
      catchError(this.handleError)
    );
  }

  getCard(id: number): Observable<Card> {
    return this.http.get<Card>(`${this.apiUrl}/${id}`).pipe(
      map(card => this.transformCard(card)),
      catchError(this.handleError)
    );
  }

  deleteCard(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      catchError(this.handleError)
    );
  }
  getCardTypes(): Observable<CardType[]> {
    return this.http.get<CardType[]>(`${this.cardTypesUrl}`).pipe(
      catchError(this.handleError)
    );
  }
  
  getBanks(): Observable<Bank[]> {
    return this.http.get<Bank[]>(`${this.banksUrl}`).pipe(
      catchError(this.handleError)
    );
  }
  syncCard(id: number): Observable<Card> {
    return this.http.post<Card>(`${this.apiUrl}/${id}/sync`, {}).pipe(
      map(card => this.transformCard(card)),
      catchError(this.handleError)
    );
  }

  addCardFromScraper(credentials: CardCredentials): Observable<any> {
    if (!credentials.rut || !credentials.password) {
      return throwError(() => new Error('Credenciales incompletas'));
    }

    return this.scraperService.createTask({
      rut: credentials.rut,
      password: credentials.password,
      site: credentials.site || 'banco-estado'
    }).pipe(
      map(task => {
        if (!task || !task.taskId) {
          throw new Error('No se pudo crear la tarea de scraping.');
        }
        return this.scraperService.pollTaskStatus(task.taskId);
      }),
      catchError(this.handleError)
    );
  }
  addCardManual(data: {
    nameAccount: string;
    aliasAccount?: string;
    cardTypeId: number;
    bankId?: number;
    balance: number;
    currency?: string;
    source?: string; // manual
  }): Observable<any> {
    return this.http.post(`${this.apiUrl}`, data).pipe(
      catchError(this.handleError)
    );
  }
  addCardFromCartola(formData: FormData): Observable<any> {
    return this.http.post(`${this.cartolasUrl}/upload`, formData).pipe(
      catchError(this.handleError)
    );
  }

  processCartolaPDF(cardId: string, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('cartola', file);

    return this.http.post(`${this.apiUrl}/${cardId}/process-cartola`, formData).pipe(
      catchError(this.handleError)
    );
  }
  syncAllCards() {
    return this.http.post<Card[]>(`${this.apiUrl}/sync`, {});
  }
  getTotalCardBalance(): Observable<number> {
    return this.http.get<{ total: number }>(`${this.apiUrl}/total-balance`).pipe(
      map(resp => resp.total),
      catchError(this.handleError)
    );
  }
  updateCard(cardId: number, data: { aliasAccount?: string; balance?: number; statusAccount?: string }): Observable<Card> {
    return this.http.put<Card>(`${this.apiUrl}/${cardId}`, data);
  }
  private handleError(error: HttpErrorResponse) {
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
      errorMessage = error.error; // Express a veces manda texto plano
    } else if (error.error?.error) {
      // Puede ser un string o un objeto
      if (typeof error.error.error === 'string') {
        errorMessage = error.error.error;
      } else if (error.error.error.message) {
        errorMessage = error.error.error.message;
      } else {
        errorMessage = JSON.stringify(error.error.error);
      }
    } else if (error.error?.message) {
      errorMessage = error.error.message;
    } else if (error.message) {
      errorMessage = error.message;
    }
  
    return throwError(() => new Error(errorMessage));
  }
} 