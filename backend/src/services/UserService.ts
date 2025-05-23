import { hash, compare } from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Pool, DatabaseError as PostgresError } from 'pg';
import { IUser, IUserLogin, IUserRegister, IUserResponse, IUserProfileUpdate, IUserAdminUpdate } from '../interfaces/IUser';
import { DatabaseError } from '../utils/errors';
import { pool } from '../config/database/connection';

export class UserService {
  private readonly SALT_ROUNDS = 10;

  public async register(userData: IUserRegister): Promise<IUserResponse> {
    try {
      console.log('1. Iniciando registro de usuario');
      console.log('2. Datos recibidos:', JSON.stringify(userData, null, 2));

      // Verificar que email y password estén presentes
      if (!userData.email?.trim() || !userData.password?.trim()) {
        throw new DatabaseError('Email y contraseña son requeridos');
      }

      console.log('3. Generando hash de contraseña');
      const hashedPassword = await hash(userData.password, this.SALT_ROUNDS);
      
      // Manejar los campos de nombre considerando ambos formatos y valores undefined
      console.log('4. Procesando campos de nombre');
      const firstName = (userData.firstName || userData.first_name || '').trim();
      const lastName = (userData.lastName || userData.last_name || '').trim();

      console.log('5. Valores de nombre procesados:', { firstName, lastName });

      const query = `
        INSERT INTO "user" (
          email, 
          password, 
          first_name, 
          last_name, 
          role, 
          is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, email, first_name, last_name, role, is_active, created_at;
      `;

      const values = [
        userData.email.trim(),
        hashedPassword,
        firstName || null,
        lastName || null,
        'user',
        true
      ];

      console.log('6. Query a ejecutar:', query);
      console.log('7. Valores para la query:', values);

      try {
        console.log('8. Intentando ejecutar la query');
        const result = await pool.query(query, values);
        console.log('9. Query ejecutada exitosamente');
        console.log('10. Resultado:', result.rows[0]);
        return result.rows[0];
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
        if (error.code === '23505') {
          throw new DatabaseError('El email ya está registrado');
        }
        // Agregar más casos específicos de errores PostgreSQL
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
      console.log('1. Iniciando proceso de login');
      console.log('2. Verificando credenciales:', { email: credentials.email });

      if (!credentials.email?.trim() || !credentials.password?.trim()) {
        throw new DatabaseError('Email y contraseña son requeridos');
      }

      const query = `
        SELECT id, email, password, first_name, last_name, role, is_active, created_at
        FROM "user"
        WHERE email = $1 AND is_active = true AND deleted_at IS NULL;
      `;

      console.log('3. Buscando usuario en la base de datos');
      const result = await pool.query(query, [credentials.email.trim()]);
      
      const user = result.rows[0];
      if (!user) {
        console.log('4. Usuario no encontrado');
        throw new DatabaseError('Credenciales inválidas');
      }

      console.log('5. Verificando contraseña');
      const isPasswordValid = await compare(credentials.password, user.password);
      if (!isPasswordValid) {
        console.log('6. Contraseña inválida');
        throw new DatabaseError('Credenciales inválidas');
      }

      console.log('7. Generando token JWT');
      const token = this.generateToken({
        id: user.id,
        email: user.email,
        role: user.role
      });

      // Eliminar la contraseña del objeto usuario antes de devolverlo
      const { password, ...userWithoutPassword } = user;

      console.log('8. Login exitoso');
      return {
        user: userWithoutPassword,
        token
      };
    } catch (error: unknown) {
      console.error('Error en el login:', error);
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError('Error durante el proceso de login');
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

  private generateToken(payload: { id: number; email: string; role: string }): string {
    // En desarrollo usamos un secreto por defecto, en producción debería venir de variables de entorno
    const jwtSecret = process.env.JWT_SECRET || 'finantrack_dev_secret_2024';

    return jwt.sign(
      payload,
      jwtSecret,
      { 
        expiresIn: '24h',
        algorithm: 'HS256'
      }
    );
  }
} 