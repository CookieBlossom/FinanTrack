import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Card } from '../../models/card.model';
import { CardService } from '../../services/card.service';
import { AddCardDialogComponent } from './add-card-dialog/add-card-dialog.component';
import { firstValueFrom } from 'rxjs';
import { NgxChartsModule } from '@swimlane/ngx-charts';
import { EditCardDialogComponent } from './edit-card-dialog/edit-card-dialog.component';
import { DeleteCardDialogComponent } from './delete-card-dialog/delete-card-dialog.component';

@Component({
  selector: 'app-card',
  templateUrl: './card.component.html',
  styleUrls: ['./card.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    NgxChartsModule,
  ]
})
export class CardComponent implements OnInit {
  cards: Card[] = [];
  error: string | null = null;
  totalBalance: number = 0;

  constructor(
    private cardService: CardService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}
  chartLabels: string[] = [];
  chartData: number[] = [];
  async ngOnInit(): Promise<void> {
    await Promise.all([
      this.loadCards(),
      this.loadTotalBalance()
    ]);
  }
  async loadTotalBalance() {
    try {
      this.totalBalance = await firstValueFrom(this.cardService.getTotalCardBalance());
    } catch (error) {
      this.totalBalance = 0;
    }
  }
  async loadCards(): Promise<void> {
    try {
      this.error = null;
      this.cards = await firstValueFrom(this.cardService.getCards());
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Error al cargar las tarjetas';
    } finally {
    }
  }
  get visibleCards(): Card[] {
    return this.cards.filter(card => card.nameAccount.toLowerCase() !== 'efectivo');
  }

  openAddCardDialog(): void {
    const dialogRef = this.dialog.open(AddCardDialogComponent, {
      width: '500px'
    });

    dialogRef.afterClosed().subscribe(async result => {
      if (result) {
        await this.loadCards();
      }
    });
  }
  getTotalBalance(): number {
    return this.cards
      .filter(card => card.statusAccount === 'active' && card.nameAccount.toLowerCase() !== 'efectivo')
      .reduce((total, card) => total + (card.balance || 0), 0);
  }
  getPieChartData() {
    return this.cards
      .filter(card => card.statusAccount === 'active' && card.nameAccount.toLowerCase() !== 'efectivo')
      .map(card => ({
        name: card.nameAccount,
        value: card.balance || 0
      }));
  }
  async deleteCard(cardId: number, cardName?: string): Promise<void> {
    const dialogRef = this.dialog.open(DeleteCardDialogComponent, {
      width: '380px',
      data: { cardName }
    });
    const confirmed = await firstValueFrom(dialogRef.afterClosed());
  
    if (!confirmed) return;
  
    try {
      await firstValueFrom(this.cardService.deleteCard(cardId));
      await this.loadCards();
      this.snackBar.open('Tarjeta eliminada con todos sus movimientos', 'Cerrar', { duration: 3000 });
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Error al eliminar la tarjeta';
      this.snackBar.open(this.error, 'Cerrar', { duration: 5000 });
    }
  }
  editCard(card: Card) {
    const dialogRef = this.dialog.open(EditCardDialogComponent, {
      width: '400px',
      data: card
    });
    dialogRef.afterClosed().subscribe(updatedCard => {
      if (updatedCard) {
        this.loadCards(); // refresca la lista si hubo cambios
      }
    });
  }
  async syncCard(): Promise<void> {
    try {
      await firstValueFrom(this.cardService.syncAllCards());
      await this.loadCards();
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Error al sincronizar la tarjeta';
    }
  }

  getCardBalance(card: Card): number {
    return card.balance || 0;
  }
}
