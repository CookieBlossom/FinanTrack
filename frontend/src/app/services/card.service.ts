import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
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

  // Headers para evitar cache
  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
  }

  constructor(
    private http: HttpClient,
    private scraperService: ScraperService
  ) {}

  private transformCard(card: Card): Card {
    console.log('🔄 Transformando tarjeta:', card);
    console.log('🔄 card.balance original:', card.balance, 'tipo:', typeof card.balance);
    
    const transformedBalance = card.balance !== undefined && card.balance !== null
      ? Number(card.balance)
      : 0;
    
    console.log('🔄 balance transformado:', transformedBalance, 'tipo:', typeof transformedBalance);
    console.log('🔄 isNaN(transformedBalance):', isNaN(transformedBalance));
    
    const result = {
      ...card,
      balance: transformedBalance,
      createdAt: card.createdAt ? new Date(card.createdAt) : undefined,
      updatedAt: card.updatedAt ? new Date(card.updatedAt) : undefined
    };
    
    console.log('🔄 Tarjeta transformada:', result);
    return result;
  }

  getCards(): Observable<Card[]> {
    // Agregar timestamp para evitar cache
    const timestamp = new Date().getTime();
    return this.http.get<Card[]>(`${this.apiUrl}?t=${timestamp}`, { headers: this.getHeaders() }).pipe(
      map(cards => cards.map(card => this.transformCard(card))),
      catchError(this.handleError)
    );
  }

  getCard(id: number): Observable<Card> {
    const timestamp = new Date().getTime();
    return this.http.get<Card>(`${this.apiUrl}/${id}?t=${timestamp}`, { headers: this.getHeaders() }).pipe(
      map(card => this.transformCard(card)),
      catchError(this.handleError)
    );
  }

  deleteCard(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`, { headers: this.getHeaders() }).pipe(
      catchError(this.handleError)
    );
  }
  
  getCardTypes(): Observable<CardType[]> {
    const timestamp = new Date().getTime();
    return this.http.get<CardType[]>(`${this.cardTypesUrl}?t=${timestamp}`, { headers: this.getHeaders() }).pipe(
      catchError(this.handleError)
    );
  }
  
  getBanks(): Observable<Bank[]> {
    const timestamp = new Date().getTime();
    return this.http.get<Bank[]>(`${this.banksUrl}?t=${timestamp}`, { headers: this.getHeaders() }).pipe(
      catchError(this.handleError)
    );
  }
  
  syncCard(id: number): Observable<Card> {
    return this.http.post<Card>(`${this.apiUrl}/${id}/sync`, {}, { headers: this.getHeaders() }).pipe(
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
    return this.http.post(`${this.apiUrl}`, data, { headers: this.getHeaders() }).pipe(
      catchError(this.handleError)
    );
  }
  
  addCardFromCartola(formData: FormData): Observable<any> {
    return this.http.post(`${this.cartolasUrl}/upload`, formData, { headers: this.getHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  processCartolaPDF(cardId: string, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('cartola', file);

    return this.http.post(`${this.apiUrl}/${cardId}/process-cartola`, formData, { headers: this.getHeaders() }).pipe(
      catchError(this.handleError)
    );
  }
  
  syncAllCards() {
    return this.http.post<Card[]>(`${this.apiUrl}/sync`, {}, { headers: this.getHeaders() });
  }
  
  getTotalCardBalance(): Observable<number> {
    const timestamp = new Date().getTime();
    return this.http.get<{ total: number }>(`${this.apiUrl}/total-balance?t=${timestamp}`, { headers: this.getHeaders() }).pipe(
      map(resp => resp.total),
      catchError(this.handleError)
    );
  }
  
  updateCard(cardId: number, data: { aliasAccount?: string; balance?: number; statusAccount?: string }): Observable<Card> {
    return this.http.put<Card>(`${this.apiUrl}/${cardId}`, data, { headers: this.getHeaders() });
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