import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, map, tap, shareReplay, first } from 'rxjs/operators';
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

  // 🔄 Sistema reactivo para mantener sincronizadas las tarjetas
  private cardsSubject = new BehaviorSubject<Card[]>([]);
  private cardsLoaded = false;
  private loadingSubject = new BehaviorSubject<boolean>(false);

  // 📡 Observables públicos para los componentes
  public cards$ = this.cardsSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable();

  // Headers para evitar cache
  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'X-Timestamp': new Date().getTime().toString()
    });
  }

  constructor(
    private http: HttpClient,
    private scraperService: ScraperService
  ) {}

  private transformCard(card: Card): Card {
    const transformedBalance = card.balance !== undefined && card.balance !== null
      ? Number(card.balance)
      : 0;
    
    const result = {
      ...card,
      balance: transformedBalance,
      createdAt: card.createdAt ? new Date(card.createdAt) : undefined,
      updatedAt: card.updatedAt ? new Date(card.updatedAt) : undefined
    };
    
    return result;
  }

  // 🔄 Método principal para obtener tarjetas (reactivo)
  getCards(): Observable<Card[]> {
    // Si ya tenemos datos, devolver el observable
    if (this.cardsLoaded) {
      return this.cards$;
    }

    // Si no tenemos datos, cargar desde el servidor
    return this.loadCardsFromServer();
  }

  // 📡 Cargar tarjetas desde el servidor y actualizar el cache
  private loadCardsFromServer(): Observable<Card[]> {
    if (this.loadingSubject.value) {
      // Si ya estamos cargando, devolver el observable actual
      return this.cards$;
    }

    this.loadingSubject.next(true);
    const timestamp = new Date().getTime();
    console.log('🌐 [CardService] Cargando tarjetas desde el servidor...');
    
    return this.http.get<Card[]>(`${this.apiUrl}?t=${timestamp}`, { headers: this.getHeaders() }).pipe(
      map(cards => {
        console.log('📦 [CardService] Respuesta del servidor:', cards);
        const transformedCards = cards.map(card => this.transformCard(card));
        console.log('🔄 [CardService] Tarjetas transformadas:', transformedCards);
        return transformedCards;
      }),
      tap(cards => {
        this.cardsSubject.next(cards);
        this.cardsLoaded = true;
        this.loadingSubject.next(false);
        console.log('✅ [CardService] Cache actualizado con', cards.length, 'tarjetas');
      }),
      catchError(error => {
        this.loadingSubject.next(false);
        return this.handleError(error);
      }),
      shareReplay(1)
    );
  }

  // 🔄 Refrescar datos desde el servidor
  refreshCards(): Observable<Card[]> {
    this.cardsLoaded = false;
    return this.loadCardsFromServer();
  }

  // 📝 Obtener tarjetas desde el cache (síncrono)
  getCardsFromCache(): Card[] {
    return this.cardsSubject.value;
  }

  // 🔍 Obtener una tarjeta específica
  getCard(id: number): Observable<Card> {
    // Primero intentar desde el cache
    const cachedCard = this.cardsSubject.value.find(card => card.id === id);
    if (cachedCard) {
      return new Observable(subscriber => {
        subscriber.next(cachedCard);
        subscriber.complete();
      });
    }

    // Si no está en cache, obtener desde el servidor
    const timestamp = new Date().getTime();
    return this.http.get<Card>(`${this.apiUrl}/${id}?t=${timestamp}`, { headers: this.getHeaders() }).pipe(
      map(card => this.transformCard(card)),
      tap(card => {
        // Actualizar el cache con la tarjeta obtenida
        const currentCards = this.cardsSubject.value;
        const updatedCards = currentCards.map(c => c.id === card.id ? card : c);
        if (!currentCards.find(c => c.id === card.id)) {
          updatedCards.push(card);
        }
        this.cardsSubject.next(updatedCards);
      }),
      catchError(this.handleError)
    );
  }

  // 🗑️ Eliminar tarjeta y actualizar cache
  deleteCard(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`, { headers: this.getHeaders() }).pipe(
      tap(() => {
        // Actualizar cache eliminando la tarjeta
        const currentCards = this.cardsSubject.value;
        const updatedCards = currentCards.filter(card => card.id !== id);
        this.cardsSubject.next(updatedCards);
        console.log('🗑️ [CardService] Tarjeta eliminada del cache:', id);
      }),
      catchError(this.handleError)
    );
  }

  // ✏️ Actualizar tarjeta y actualizar cache
  updateCard(cardId: number, data: { accountHolder?: string; balance?: number; statusAccount?: string }): Observable<Card> {
    return this.http.put<Card>(`${this.apiUrl}/${cardId}`, data, { headers: this.getHeaders() }).pipe(
      map(card => this.transformCard(card)),
      tap(updatedCard => {
        // Actualizar cache con la tarjeta actualizada
        const currentCards = this.cardsSubject.value;
        const updatedCards = currentCards.map(card => 
          card.id === updatedCard.id ? updatedCard : card
        );
        this.cardsSubject.next(updatedCards);
        console.log('✏️ [CardService] Tarjeta actualizada en cache:', updatedCard.id);
      }),
      catchError(this.handleError)
    );
  }

  // ➕ Agregar tarjeta manual y actualizar cache
  addCardManual(data: {
    nameAccount: string;
    accountHolder?: string;
    cardTypeId: number;
    bankId?: number;
    balance: number;
    currency?: string;
    source?: string;
  }): Observable<Card> {
    return this.http.post<Card>(`${this.apiUrl}`, data, { headers: this.getHeaders() }).pipe(
      map(card => this.transformCard(card)),
      tap(newCard => {
        // Agregar nueva tarjeta al cache
        const currentCards = this.cardsSubject.value;
        const updatedCards = [...currentCards, newCard];
        this.cardsSubject.next(updatedCards);
        console.log('➕ [CardService] Nueva tarjeta agregada al cache:', newCard.id);
      }),
      catchError(this.handleError)
    );
  }

  // 📊 Obtener balance total (desde cache si está disponible)
  getTotalCardBalance(): Observable<number> {
    const cachedCards = this.cardsSubject.value;
    if (cachedCards.length > 0) {
      const total = cachedCards
        .filter(card => card.statusAccount === 'active')
        .reduce((sum, card) => sum + (card.balance || 0), 0);
      return new Observable(subscriber => {
        subscriber.next(total);
        subscriber.complete();
      });
    }

    // Si no hay cache, obtener desde el servidor
    const timestamp = new Date().getTime();
    return this.http.get<{ total: number }>(`${this.apiUrl}/total-balance?t=${timestamp}`, { headers: this.getHeaders() }).pipe(
      map(resp => resp.total),
      catchError(this.handleError)
    );
  }

  // 🔄 Sincronizar todas las tarjetas
  syncAllCards(): Observable<Card[]> {
    return this.http.post<Card[]>(`${this.apiUrl}/sync`, {}, { headers: this.getHeaders() }).pipe(
      map(cards => cards.map(card => this.transformCard(card))),
      tap(cards => {
        this.cardsSubject.next(cards);
        console.log('🔄 [CardService] Todas las tarjetas sincronizadas:', cards.length);
      }),
      catchError(this.handleError)
    );
  }

  // 🔄 Sincronizar una tarjeta específica
  syncCard(id: number): Observable<Card> {
    return this.http.post<Card>(`${this.apiUrl}/${id}/sync`, {}, { headers: this.getHeaders() }).pipe(
      map(card => this.transformCard(card)),
      tap(updatedCard => {
        // Actualizar cache con la tarjeta sincronizada
        const currentCards = this.cardsSubject.value;
        const updatedCards = currentCards.map(card => 
          card.id === updatedCard.id ? updatedCard : card
        );
        this.cardsSubject.next(updatedCards);
        console.log('🔄 [CardService] Tarjeta sincronizada:', updatedCard.id);
      }),
      catchError(this.handleError)
    );
  }

  // 🏦 Obtener tipos de tarjeta (con cache)
  private cardTypesCache$?: Observable<CardType[]>;
  getCardTypes(): Observable<CardType[]> {
    if (!this.cardTypesCache$) {
      const timestamp = new Date().getTime();
      this.cardTypesCache$ = this.http.get<CardType[]>(`${this.cardTypesUrl}?t=${timestamp}`, { headers: this.getHeaders() }).pipe(
        shareReplay(1),
        catchError(this.handleError)
      );
    }
    return this.cardTypesCache$;
  }

  // 🏦 Obtener bancos (con cache)
  private banksCache$?: Observable<Bank[]>;
  getBanks(): Observable<Bank[]> {
    if (!this.banksCache$) {
      const timestamp = new Date().getTime();
      this.banksCache$ = this.http.get<Bank[]>(`${this.banksUrl}?t=${timestamp}`, { headers: this.getHeaders() }).pipe(
        shareReplay(1),
        catchError(this.handleError)
      );
    }
    return this.banksCache$;
  }

  // 🤖 Scraper methods (mantener compatibilidad)
  addCardFromScraper(credentials: CardCredentials): Observable<any> {
    if (!credentials.rut || !credentials.password) {
      return throwError(() => new Error('Credenciales incompletas'));
    }

    return this.scraperService.startScraping({
      rut: credentials.rut,
      password: credentials.password,
      site: credentials.site || 'banco-estado'
    }).pipe(
      map(response => {
        if (!response.success || !response.data?.taskId) {
          throw new Error('No se pudo crear la tarea de scraping.');
        }
        return this.scraperService.monitorTask(response.data.taskId);
      }),
      catchError(this.handleError)
    );
  }

  addCardFromCartola(formData: FormData): Observable<any> {
    return this.http.post(`${this.cartolasUrl}/upload`, formData, { headers: this.getHeaders() }).pipe(
      tap(() => {
        // Después de subir cartola, refrescar las tarjetas
        this.refreshCards().pipe(first()).subscribe();
      }),
      catchError(this.handleError)
    );
  }

  processCartolaPDF(cardId: string, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('cartola', file);

    return this.http.post(`${this.apiUrl}/${cardId}/process-cartola`, formData, { headers: this.getHeaders() }).pipe(
      tap(() => {
        // Después de procesar cartola, refrescar las tarjetas
        this.refreshCards().pipe(first()).subscribe();
      }),
      catchError(this.handleError)
    );
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
      errorMessage = error.error;
    } else if (error.error?.error) {
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