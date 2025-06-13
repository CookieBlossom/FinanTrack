import { hash, compare } from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Pool, DatabaseError as PostgresError } from 'pg';
import { IUser, IUserLogin, IUserRegister, IUserResponse, IUserProfileUpdate, IUserAdminUpdate } from '../interfaces/IUser';
import { DatabaseError, UserAlreadyExistsError } from '../utils/errors';
import { pool } from '../config/database/connection';
import { sign } from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { generateToken } from '../utils/tokenUtils';
import { sendResetPasswordEmail } from '../utils/mailer';
import { hashPassword, comparePasswords } from '../utils/passwordUtils';
import { getPasswordResetTemplate } from '../utils/templates';
import bcrypt from 'bcrypt';
export class UserService {
  private readonly SALT_ROUNDS = 10;
  private pool: Pool;

  constructor() {
    this.pool = pool;
  }

  public async register(userData: IUserRegister): Promise<IUserResponse> {
    try {
      console.log('2. Datos recibidos:', JSON.stringify(userData, null, 2));
      if (!userData.email?.trim() || !userData.password?.trim()) {
        throw new DatabaseError('Email y contraseña son requeridos');
      }
      const hashedPassword = await hash(userData.password, this.SALT_ROUNDS);
      const firstName = (userData.firstName || userData.first_name || '').trim();
      const lastName = (userData.lastName || userData.last_name || '').trim();
      const countryCode = userData.country_code || '+56';
      const phone = userData.phone || null;
      const query = `
        INSERT INTO "user" (
          email, 
          password, 
          first_name, 
          last_name,
          country_code,
          phone,
          role, 
          is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, email, first_name, last_name, country_code, phone, role, is_active, created_at;
      `;

      const values = [
        userData.email.trim(),
        hashedPassword,
        firstName || null,
        lastName || null,
        countryCode,
        phone,
        'user',
        true
      ];
      try {
        const result = await this.pool.query(query, values);
        const user = result.rows[0];
        const cardTypeQuery = `SELECT id FROM card_types WHERE name = 'Efectivo' LIMIT 1;`;
        const cardTypeResult = await this.pool.query(cardTypeQuery);
        const efectivoCardTypeId = cardTypeResult.rows[0]?.id;
        if (!efectivoCardTypeId) {
          throw new DatabaseError('No se encontró el tipo de tarjeta Efectivo');
        }
        // Crear tarjeta Efectivo
        const cardInsertQuery = `
          INSERT INTO cards (
            user_id, 
            name_account, 
            alias_account, 
            card_type_id, 
            balance, 
            currency, 
            status_account
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `;
        const cardInsertValues = [
          user.id,
          'Efectivo',
          'Efectivo',
          efectivoCardTypeId,
          0,
          'CLP',
          'active'
        ];
        await this.pool.query(cardInsertQuery, cardInsertValues);
        return user;
      } catch (dbError) {
        console.error('Error en la ejecución de la query:', dbError);
        if (dbError instanceof PostgresError) {
          console.error('Código de error PostgreSQL:', dbError.code);
          console.error('Detalle del error:', dbError.detail);
          console.error('Esquema:', dbError.schema);
          console.error('Tabla:', dbError.table);
          console.error('Columna:', dbError.column);
        }
        throw dbError;
      }
    } catch (error: unknown) {
      console.error('Error en el registro:', error);
      if (error instanceof PostgresError) {
        if (error.code === '23505' && error.detail?.includes('user_email_key')) {
          throw new UserAlreadyExistsError();
        }
        if (error.code === '23502') {
          throw new DatabaseError(`Campo requerido no puede ser nulo: ${error.column}`);
        }
        if (error.code === '42P01') {
          throw new DatabaseError('La tabla no existe');
        }
      }
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError('Error al registrar el usuario: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    }
  }

  public async login(credentials: IUserLogin): Promise<{ user: IUserResponse; token: string }> {
    try {
      if (!credentials.email?.trim() || !credentials.password?.trim()) {
        throw new DatabaseError('El correo electrónico y la contraseña son requeridos');
      }
      const query = `
        SELECT id, email, password, first_name, last_name, role, is_active, created_at
        FROM "user"
        WHERE email = $1 AND deleted_at IS NULL;
      `;

      const result = await this.pool.query(query, [credentials.email.trim()]);
      const user = result.rows[0];
      if (!user) {
        throw new DatabaseError('El usuario no existe');
      }
      if (!user.is_active) {
        throw new DatabaseError('La cuenta está desactivada');
      }
      const isPasswordValid = await compare(credentials.password, user.password);
      if (!isPasswordValid) {
        throw new DatabaseError('La contraseña es incorrecta');
      }
      const name = (user.first_name || user.firstName || '') +
      ((user.last_name || user.lastName) ? ' ' + (user.last_name || user.lastName) : '');

      // const token = this.generateToken({
      // id: user.id,
      // email: user.email,
      // name: name.trim() || user.email, // ¡Siempre envía un 'name'!
      // role: user.role
      // });
      const payload = {
        id: user.id,
        email: user.email,
        name: user.email,
        role: user.role
      };
      const token = jwt.sign(payload, process.env.JWT_SECRET!, {
        expiresIn: '1h'
      });
      const { password, ...userWithoutPassword } = user;

      return {
        user: userWithoutPassword,
        token
      };
    } catch (error: unknown) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError('Error durante el proceso de login');
    }
  }

  public async getProfile(userId: number): Promise<IUserResponse> {
    try {
      const query = `
        SELECT id, email, first_name, last_name, country_code, phone, role, created_at, updated_at
        FROM "user"
        WHERE id = $1;
      `;

      const result = await this.pool.query(query, [userId]);
      if (!result.rows[0]) {
        throw new DatabaseError('User not found');
      }

      return result.rows[0];
    } catch (error: unknown) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError('Error fetching user profile');
    }
  }

  public async updateProfile(userId: number, userData: IUserProfileUpdate): Promise<IUserResponse> {
    try {
      const updates: string[] = [];
      const values: any[] = [userId];
      let paramCount = 2;

      // Mapear los campos del frontend a los nombres de columna de la base de datos
      if (userData.firstName !== undefined) {
        updates.push(`first_name = $${paramCount}`);
        values.push(userData.firstName);
        paramCount++;
      }
      if (userData.lastName !== undefined) {
        updates.push(`last_name = $${paramCount}`);
        values.push(userData.lastName);
        paramCount++;
      }
      if (userData.countryCode !== undefined) {
        updates.push(`country_code = $${paramCount}`);
        values.push(userData.countryCode);
        paramCount++;
      }
      if (userData.phone !== undefined) {
        updates.push(`phone = $${paramCount}`);
        values.push(userData.phone);
        paramCount++;
      }

      if (updates.length === 0) {
        throw new DatabaseError('No valid fields to update');
      }

      const query = `
        UPDATE "user"
        SET ${updates.join(', ')}, updated_at = NOW()
        WHERE id = $1 AND is_active = TRUE AND deleted_at IS NULL
        RETURNING id, email, first_name, last_name, country_code, phone, role, is_active, created_at, updated_at;
      `;

      console.log('Query:', query);
      console.log('Values:', values);

      const result = await this.pool.query(query, values);

      if (!result.rows[0]) {
        throw new DatabaseError('User not found or inactive');
      }

      return result.rows[0];
    } catch (error: unknown) {
      console.error('Error updating profile:', error);
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError('Error updating user profile');
    }
  }

  public async adminUpdateUser(userId: number, userData: IUserAdminUpdate): Promise<IUserResponse> {
    try {
      const updates = Object.entries(userData)
        .filter(([key]) => ['firstName', 'lastName', 'role', 'isActive'].includes(key))
        .map(([key, value]) => `${this.toSnakeCase(key)} = $${key}`);

      if (updates.length === 0) {
        throw new DatabaseError('No valid fields to update');
      }

      const query = `
        UPDATE "user"
        SET ${updates.join(', ')}, updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING id, email, first_name, last_name, role, is_active, created_at, updated_at;
      `;

      const values = [userId, ...Object.values(userData)];
      const result = await this.pool.query(query, values);

      if (!result.rows[0]) {
        throw new DatabaseError('User not found');
      }

      return result.rows[0];
    } catch (error: unknown) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError('Error updating user');
    }
  }

  public async deleteUser(userId: number): Promise<void> {
    try {
      const query = `
        UPDATE "user"
        SET deleted_at = NOW(), is_active = FALSE, updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING id;
      `;

      const result = await this.pool.query(query, [userId]);
      if (!result.rows[0]) {
        throw new DatabaseError('User not found or already deleted');
      }
    } catch (error: unknown) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError('Error deleting user');
    }
  }

  public async changePassword(userId: number, currentPassword: string, newPassword: string): Promise<void> {
    try {
      const user = await this.pool.query('SELECT password FROM "user" WHERE id = $1', [userId]);
      
      if (!user.rows[0]) {
        throw new DatabaseError('User not found');
      }

      const isPasswordValid = await compare(currentPassword, user.rows[0].password);
      if (!isPasswordValid) {
        throw new DatabaseError('Current password is incorrect');
      }

      const hashedPassword = await hash(newPassword, this.SALT_ROUNDS);
      await this.pool.query(
        'UPDATE "user" SET password = $1, updated_at = NOW() WHERE id = $2',
        [hashedPassword, userId]
      );
    } catch (error: unknown) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError('Error changing password');
    }
  }

  async getUserById(id: number): Promise<IUser | null> {
    const query = `
      SELECT id, email, name, password, created_at as "createdAt", updated_at as "updatedAt"
      FROM users
      WHERE id = $1
    `;
    const result = await this.pool.query(query, [id]);
    return result.rows[0] || null;
  }

  async getUserByEmail(email: string): Promise<IUser | null> {
    const query = `
      SELECT id, email, name, password, created_at as "createdAt", updated_at as "updatedAt"
      FROM users
      WHERE email = $1
    `;
    const result = await this.pool.query(query, [email]);
    return result.rows[0] || null;
  }

  private async findByEmail(email: string): Promise<IUser | null> {
    const query = `
      SELECT id, email, password, first_name, last_name, role, is_active
      FROM "user"
      WHERE email = $1 AND deleted_at IS NULL;
    `;
    const result = await this.pool.query(query, [email]);
    return result.rows[0] || null;
  }

  public async forgotPassword(email: string): Promise<void> {
    try {
      const user = await this.findByEmail(email);
      if (!user) {
        throw new DatabaseError('No existe una cuenta con este email');
      }

      const resetToken = generateToken();
      const tokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

      await this.pool.query(
        `UPDATE "user" SET reset_token = $1, reset_token_expiry = $2 WHERE id = $3`,
        [resetToken, tokenExpiry, user.id]
      );

      const resetUrl = `${process.env.FRONTEND_URL}/forgot-password?token=${resetToken}`;
      const html = getPasswordResetTemplate(resetUrl);

      await sendResetPasswordEmail({
        to: email,
        subject: 'Recuperación de Contraseña - FinanTrack',
        html
      });
    } catch (error) {
      console.error('Error en forgotPassword:', error);
      throw new DatabaseError('No se pudo enviar el correo de recuperación');
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const result = await this.pool.query(
      `SELECT id, password, reset_token_expiry FROM "user" WHERE reset_token = $1`,
      [token]
    );
  
    const user = result.rows[0];
  
    if (!user) {
      throw new DatabaseError('Token inválido');
    }
  
    if (new Date(user.reset_token_expiry) < new Date()) {
      throw new DatabaseError('El token ha expirado');
    }
  
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      throw new DatabaseError('La nueva contraseña no puede ser igual a la anterior');
    }
  
    const hashedPassword = await bcrypt.hash(newPassword, 10);
  
    await this.pool.query(
      `UPDATE "user"
       SET password = $1, reset_token = NULL, reset_token_expiry = NULL
       WHERE id = $2`,
      [hashedPassword, user.id]
    );
  }

  private toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  private generateToken(payload: { id: number; email: string; role: string; name: string }): string {
    const jwtSecret = process.env.JWT_SECRET || 'finantrack_dev_secret_2024';
    return jwt.sign(payload, jwtSecret, { expiresIn: '24h', algorithm: 'HS256' });
  }
} 