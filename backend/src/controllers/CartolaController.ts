import { Request, Response, NextFunction } from 'express';
import { CartolaService } from '../services/cartola.service';
import { DatabaseError } from '../utils/errors';
import { AuthRequest } from '../interfaces/AuthRequest';
import { Pool } from 'pg';

export class CartolaController {
  private cartolaService: CartolaService;
  private pool: Pool;

  constructor() {
    this.cartolaService = new CartolaService();
    this.pool = new Pool({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      port: parseInt(process.env.DB_PORT || '5432'),
    });
  }

  private async findOrCreateCard(
    userId: number,
    tituloCartola: string,
    clienteNombre: string,
    saldoAnterior: number,
    fechaConsulta: Date
  ): Promise<number> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const nombreCuenta = tituloCartola
        .replace(/^CARTOLA\s+/i, '')
        .replace(/\s+/g, ' ')
        .trim();

      console.log('Nombre de cuenta procesado:', nombreCuenta);
      const aliasAccount = `${clienteNombre} - ${fechaConsulta.toISOString().split('T')[0]}`;
      const findCardQuery = `
        SELECT id 
        FROM cards 
        WHERE user_id = $1 
        AND name_account = $2
      `;

      const existingCard = await client.query(findCardQuery, [userId, nombreCuenta]);

      if (existingCard.rows.length > 0) {
        await client.query(
          'UPDATE cards SET balance = $1 WHERE id = $2',
          [saldoAnterior, existingCard.rows[0].id]
        );
        await client.query('COMMIT');
        return existingCard.rows[0].id;
      }

      let cardTypeName = 'OTRO';
      if (nombreCuenta.includes('CUENTARUT')) {
        cardTypeName = 'CUENTA RUT';
      } else if (nombreCuenta.includes('CREDITO')) {
        cardTypeName = 'TARJETA DE CREDITO';
      } else if (nombreCuenta.includes('DEBITO')) {
        cardTypeName = 'TARJETA DE DEBITO';
      } else if (nombreCuenta.includes('AHORRO')) {
        cardTypeName = 'CUENTA DE AHORRO';
      }

      const findTypeQuery = `
        SELECT id FROM card_types 
        WHERE name = $1
        LIMIT 1
      `;

      const cardType = await client.query(findTypeQuery, [cardTypeName]);
      let cardTypeId: number;

      if (cardType.rows.length === 0) {
        const createTypeResult = await client.query(
          'INSERT INTO card_types (name) VALUES ($1) RETURNING id',
          [cardTypeName]
        );
        cardTypeId = createTypeResult.rows[0].id;
      } else {
        cardTypeId = cardType.rows[0].id;
      }

      const createCardResult = await client.query(
        `INSERT INTO cards (
          user_id, 
          name_account, 
          alias_account,
          card_type_id, 
          balance, 
          currency, 
          status_account
        ) VALUES ($1, $2, $3, $4, $5, $6, $7) 
        RETURNING id`,
        [
          userId,
          nombreCuenta,
          aliasAccount,
          cardTypeId,
          saldoAnterior,
          'CLP',
          'active'
        ]
      );

      await client.query('COMMIT');
      return createCardResult.rows[0].id;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public uploadCartola = async (req: Request & { file?: any }, res: Response, next: NextFunction) => {
    const crypto = await import('crypto');
    const client = await this.pool.connect();
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No se ha proporcionado ningún archivo' });
      }

      if (req.file.mimetype !== 'application/pdf') {
        return res.status(400).json({ error: 'El archivo debe ser un PDF' });
      }

      const user = (req as AuthRequest).user;
      if (!user) {
        return res.status(401).json({ error: 'Usuario no autenticado' });
      }

      const fileBuffer = req.file.buffer;
      const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      await client.connect();

      const existing = await client.query(
        'SELECT * FROM statements WHERE user_id = $1 AND file_hash = $2',
        [user.id, hash]
      );
      if (existing.rows.length > 0) {
        await client.release();
        return res.status(409).json({ error: 'Esta cartola ya ha sido subida.' });
      }

      const cartola = await this.cartolaService.procesarCartolaPDF(fileBuffer);

      const cardId = await this.findOrCreateCard(
        user.id,
        cartola.tituloCartola,
        cartola.clienteNombre,
        cartola.saldoAnterior,
        cartola.fechaHoraConsulta
      );

      await this.cartolaService.guardarMovimientos(cardId, cartola.movimientos, user.id, user.planId);

      await client.query(
        `INSERT INTO statements (user_id, card_id, file_hash, processed_at) 
         VALUES ($1, $2, $3, NOW())`,
        [user.id, cardId, hash]
      );

      await client.release();

      res.json({
        message: 'Cartola procesada exitosamente',
        resumen: {
          tituloCartola: cartola.tituloCartola,
          numeroCartola: cartola.numero,
          fechaEmision: cartola.fechaEmision,
          totalMovimientos: cartola.movimientos.length,
          totalAbonos: cartola.totalAbonos,
          totalCargos: cartola.totalCargos,
          cardId: cardId
        }
      });

    } catch (error) {
      client.release();
      console.error('Error al procesar cartola:', error);

      if (error instanceof DatabaseError) {
        if (error.message.includes('límite') || error.message.includes('no incluye')) {
          return res.status(403).json({ error: error.message });
        }
        return res.status(500).json({ error: 'Error al guardar los movimientos en la base de datos' });
      }

      res.status(500).json({ error: 'Error al procesar la cartola' });
    }
  };
}