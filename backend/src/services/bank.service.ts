import { Pool } from 'pg';
import { pool } from '../config/database/connection';

export class BankService {
  private pool: Pool;

  constructor() {
      this.pool = pool;
  }
  public async getAllBanks() {
    try {
      const query = `SELECT id, name FROM banks ORDER BY name;`;
      const result = await pool.query(query);
      return result.rows;
    } catch (error) {
      console.error('Error SQL:', error);
      throw error;
    }
  }
}