import { hash, compare } from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Pool, DatabaseError as PostgresError } from 'pg';
import { IUser, IUserLogin, IUserRegister, IUserResponse, IUserProfileUpdate, IUserAdminUpdate } from '../interfaces/IUser';
import { DatabaseError } from '../utils/errors';
import { pool } from '../config/database/connection.js';

export class UserService {
  private readonly SALT_ROUNDS = 10;

  public async register(userData: IUserRegister): Promise<IUserResponse> {
    try {
      const hashedPassword = await hash(userData.password, this.SALT_ROUNDS);
      
      const query = `
        INSERT INTO "user" (email, password, first_name, last_name, role)
        VALUES ($1, $2, $3, $4, 'user')
        RETURNING id, email, first_name, last_name, role, created_at;
      `;

      const values = [
        userData.email,
        hashedPassword,
        userData.firstName,
        userData.lastName
      ];

      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error: unknown) {
      if (error instanceof PostgresError && error.code === '23505') {
        throw new DatabaseError('Email already exists');
      }
      throw new DatabaseError('Error registering user');
    }
  }

  public async login(credentials: IUserLogin): Promise<{ user: IUserResponse; token: string }> {
    try {
      const query = 'SELECT * FROM "user" WHERE email = $1';
      const result = await pool.query(query, [credentials.email]);

      const user = result.rows[0];
      if (!user) {
        throw new DatabaseError('Invalid credentials');
      }

      const isPasswordValid = await compare(credentials.password, user.password);
      if (!isPasswordValid) {
        throw new DatabaseError('Invalid credentials');
      }

      const token = this.generateToken(user);
      const { password, ...userWithoutPassword } = user;

      return {
        user: userWithoutPassword,
        token
      };
    } catch (error: unknown) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError('Error during login');
    }
  }

  public async getProfile(userId: number): Promise<IUserResponse> {
    try {
      const query = `
        SELECT id, email, first_name, last_name, role, created_at, updated_at
        FROM "user"
        WHERE id = $1;
      `;

      const result = await pool.query(query, [userId]);
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
      const updates = Object.entries(userData)
        .filter(([key]) => ['firstName', 'lastName'].includes(key))
        .map(([key, value]) => `${this.toSnakeCase(key)} = $${key}`);

      if (updates.length === 0) {
        throw new DatabaseError('No valid fields to update');
      }

      const query = `
        UPDATE "user"
        SET ${updates.join(', ')}, updated_at = NOW()
        WHERE id = $1 AND is_active = TRUE AND deleted_at IS NULL
        RETURNING id, email, first_name, last_name, role, is_active, created_at, updated_at;
      `;

      const values = [userId, ...Object.values(userData)];
      const result = await pool.query(query, values);

      if (!result.rows[0]) {
        throw new DatabaseError('User not found or inactive');
      }

      return result.rows[0];
    } catch (error: unknown) {
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
      const result = await pool.query(query, values);

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

      const result = await pool.query(query, [userId]);
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

  private toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  public async changePassword(userId: number, currentPassword: string, newPassword: string): Promise<void> {
    try {
      const user = await pool.query('SELECT password FROM "user" WHERE id = $1', [userId]);
      
      if (!user.rows[0]) {
        throw new DatabaseError('User not found');
      }

      const isPasswordValid = await compare(currentPassword, user.rows[0].password);
      if (!isPasswordValid) {
        throw new DatabaseError('Current password is incorrect');
      }

      const hashedPassword = await hash(newPassword, this.SALT_ROUNDS);
      await pool.query(
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

  private generateToken(user: IUser): string {
    return jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );
  }
} 