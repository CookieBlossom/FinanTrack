"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const bcryptjs_1 = require("bcryptjs");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const pg_1 = require("pg");
const errors_1 = require("../utils/errors");
const connection_1 = require("../config/database/connection");
const tokenUtils_1 = require("../utils/tokenUtils");
const mailer_1 = require("../utils/mailer");
const templates_1 = require("../utils/templates");
class UserService {
    constructor() {
        this.SALT_ROUNDS = 10;
        this.pool = connection_1.pool;
    }
    async register(userData) {
        try {
            console.log('2. Datos recibidos:', JSON.stringify(userData, null, 2));
            if (!userData.email?.trim() || !userData.password?.trim()) {
                throw new errors_1.DatabaseError('Email y contraseña son requeridos');
            }
            // Verificar si el email ya existe antes de intentar insertar
            const existingUserQuery = `SELECT id FROM "user" WHERE email = $1 AND deleted_at IS NULL`;
            const existingUserResult = await this.pool.query(existingUserQuery, [userData.email.trim()]);
            if (existingUserResult.rows.length > 0) {
                throw new errors_1.UserAlreadyExistsError('El email ya está registrado en el sistema');
            }
            const hashedPassword = await (0, bcryptjs_1.hash)(userData.password, this.SALT_ROUNDS);
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
          plan_id,
          is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, email, first_name, last_name, country_code, phone, role, plan_id, is_active, created_at;
      `;
            const values = [
                userData.email.trim(),
                hashedPassword,
                firstName || null,
                lastName || null,
                countryCode,
                phone,
                'user',
                1, // Plan básico por defecto
                true
            ];
            let result;
            try {
                result = await this.pool.query(query, values);
            }
            catch (dbError) {
                // Capturar específicamente errores de PostgreSQL
                if (dbError instanceof pg_1.DatabaseError) {
                    console.error('Error PostgreSQL detectado:', {
                        code: dbError.code,
                        detail: dbError.detail,
                        message: dbError.message
                    });
                    if (dbError.code === '23505') {
                        // Error de clave duplicada - aunque ya verificamos, puede haber condición de carrera
                        if (dbError.detail?.includes('user_email_key') || dbError.detail?.includes('email')) {
                            throw new errors_1.UserAlreadyExistsError('El email ya está registrado en el sistema');
                        }
                        throw new errors_1.DatabaseError('Ya existe un registro con estos datos');
                    }
                    if (dbError.code === '23502') {
                        throw new errors_1.DatabaseError(`Campo requerido no puede ser nulo: ${dbError.column}`);
                    }
                    if (dbError.code === '42P01') {
                        throw new errors_1.DatabaseError('La tabla no existe');
                    }
                    // Para cualquier otro error de PostgreSQL, lanzar error genérico
                    throw new errors_1.DatabaseError('Error al procesar la solicitud');
                }
                // Si no es un error de PostgreSQL, relanzarlo
                throw dbError;
            }
            const user = result.rows[0];
            const cardTypeQuery = `SELECT id FROM card_types WHERE name = 'Efectivo' LIMIT 1;`;
            const cardTypeResult = await this.pool.query(cardTypeQuery);
            const efectivoCardTypeId = cardTypeResult.rows[0]?.id;
            if (!efectivoCardTypeId) {
                throw new errors_1.DatabaseError('No se encontró el tipo de tarjeta Efectivo');
            }
            // Crear tarjeta Efectivo
            const cardInsertQuery = `
        INSERT INTO cards (
          user_id, 
          name_account, 
          card_type_id, 
          balance, 
          balance_source,
          source,
          status_account
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `;
            const cardInsertValues = [
                user.id,
                'Efectivo',
                efectivoCardTypeId,
                0,
                'manual',
                'manual',
                'active'
            ];
            await this.pool.query(cardInsertQuery, cardInsertValues);
            return user;
        }
        catch (error) {
            console.error('Error en el registro:', error);
            // Si ya es un error personalizado, lo relanzamos
            if (error instanceof errors_1.UserAlreadyExistsError || error instanceof errors_1.DatabaseError) {
                throw error;
            }
            // Para cualquier otro error, lanzar error genérico
            throw new errors_1.DatabaseError('Error al registrar el usuario. Por favor, intente nuevamente.');
        }
    }
    async login(credentials) {
        try {
            if (!credentials.email?.trim() || !credentials.password?.trim()) {
                throw new errors_1.DatabaseError('El correo electrónico y la contraseña son requeridos');
            }
            const query = `
        SELECT id, email, password, first_name, last_name, role, is_active, created_at
        FROM "user"
        WHERE email = $1 AND deleted_at IS NULL;
      `;
            const planQuery = `
      SELECT p.id AS plan_id, p.name AS plan_name
      FROM "user" u
      LEFT JOIN plans p ON u.plan_id = p.id
      WHERE u.id = $1
      `;
            const result = await this.pool.query(query, [credentials.email.trim()]);
            const user = result.rows[0];
            if (!user) {
                throw new errors_1.DatabaseError('El usuario no existe');
            }
            if (!user.is_active) {
                throw new errors_1.DatabaseError('La cuenta está desactivada');
            }
            const isPasswordValid = await (0, bcryptjs_1.compare)(credentials.password, user.password);
            if (!isPasswordValid) {
                throw new errors_1.DatabaseError('La contraseña es incorrecta');
            }
            const name = (user.first_name || user.firstName || '') +
                ((user.last_name || user.lastName) ? ' ' + (user.last_name || user.lastName) : '');
            const planRes = await this.pool.query(planQuery, [user.id]);
            const planData = planRes.rows[0] || { plan_id: 1, plan_name: 'basic' };
            const { plan_id, plan_name } = planData;
            const payload = {
                id: user.id,
                email: user.email,
                name: user.email,
                role: user.role,
                planId: plan_id,
                planName: plan_name
            };
            const token = jsonwebtoken_1.default.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
            const { password, ...userWithoutPassword } = user;
            return {
                user: userWithoutPassword,
                token
            };
        }
        catch (error) {
            if (error instanceof errors_1.DatabaseError) {
                throw error;
            }
            throw new errors_1.DatabaseError('Error durante el proceso de login');
        }
    }
    async getProfile(userId) {
        try {
            const query = `
        SELECT u.id, u.email, u.first_name, u.last_name, u.country_code, u.phone, u.role, 
               u.created_at, u.updated_at, u.plan_id, p.name as plan_name
        FROM "user" u
        LEFT JOIN plans p ON u.plan_id = p.id
        WHERE u.id = $1;
      `;
            const result = await this.pool.query(query, [userId]);
            if (!result.rows[0]) {
                throw new errors_1.DatabaseError('User not found');
            }
            return result.rows[0];
        }
        catch (error) {
            if (error instanceof errors_1.DatabaseError) {
                throw error;
            }
            throw new errors_1.DatabaseError('Error fetching user profile');
        }
    }
    async updateProfile(userId, userData) {
        try {
            const updates = [];
            const values = [userId];
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
                throw new errors_1.DatabaseError('No valid fields to update');
            }
            const updateQuery = `
        UPDATE "user"
        SET ${updates.join(', ')}, updated_at = NOW()
        WHERE id = $1 AND is_active = TRUE AND deleted_at IS NULL
        RETURNING id;
      `;
            const updateResult = await this.pool.query(updateQuery, values);
            if (!updateResult.rows[0]) {
                throw new errors_1.DatabaseError('User not found or inactive');
            }
            // Obtener los datos completos del usuario actualizado
            const selectQuery = `
        SELECT u.id, u.email, u.first_name, u.last_name, u.country_code, u.phone, u.role, 
               u.is_active, u.created_at, u.updated_at, u.plan_id, p.name as plan_name
        FROM "user" u
        LEFT JOIN plans p ON u.plan_id = p.id
        WHERE u.id = $1;
      `;
            const selectResult = await this.pool.query(selectQuery, [userId]);
            return selectResult.rows[0];
        }
        catch (error) {
            console.error('Error updating profile:', error);
            if (error instanceof errors_1.DatabaseError) {
                throw error;
            }
            throw new errors_1.DatabaseError('Error updating user profile');
        }
    }
    async adminUpdateUser(userId, userData) {
        try {
            const updates = Object.entries(userData)
                .filter(([key]) => ['firstName', 'lastName', 'role', 'isActive'].includes(key))
                .map(([key, value]) => `${this.toSnakeCase(key)} = $${key}`);
            if (updates.length === 0) {
                throw new errors_1.DatabaseError('No valid fields to update');
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
                throw new errors_1.DatabaseError('User not found');
            }
            return result.rows[0];
        }
        catch (error) {
            if (error instanceof errors_1.DatabaseError) {
                throw error;
            }
            throw new errors_1.DatabaseError('Error updating user');
        }
    }
    async deleteUser(userId) {
        try {
            const query = `
        UPDATE "user"
        SET deleted_at = NOW(), is_active = FALSE, updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING id;
      `;
            const result = await this.pool.query(query, [userId]);
            if (!result.rows[0]) {
                throw new errors_1.DatabaseError('User not found or already deleted');
            }
        }
        catch (error) {
            if (error instanceof errors_1.DatabaseError) {
                throw error;
            }
            throw new errors_1.DatabaseError('Error deleting user');
        }
    }
    async changePassword(userId, currentPassword, newPassword) {
        try {
            const user = await this.pool.query('SELECT password FROM "user" WHERE id = $1', [userId]);
            if (!user.rows[0]) {
                throw new errors_1.DatabaseError('User not found');
            }
            const isPasswordValid = await (0, bcryptjs_1.compare)(currentPassword, user.rows[0].password);
            if (!isPasswordValid) {
                throw new errors_1.DatabaseError('Current password is incorrect');
            }
            const hashedPassword = await (0, bcryptjs_1.hash)(newPassword, this.SALT_ROUNDS);
            await this.pool.query('UPDATE "user" SET password = $1, updated_at = NOW() WHERE id = $2', [hashedPassword, userId]);
        }
        catch (error) {
            if (error instanceof errors_1.DatabaseError) {
                throw error;
            }
            throw new errors_1.DatabaseError('Error changing password');
        }
    }
    async getUserById(id) {
        const query = `
      SELECT 
        id, 
        email, 
        first_name as "firstName", 
        last_name as "lastName", 
        password, 
        country_code as "countryCode", 
        phone, 
        role, 
        plan_id, 
        is_active as "isActive", 
        created_at as "createdAt", 
        updated_at as "updatedAt",
        deleted_at as "deletedAt"
      FROM "user"
      WHERE id = $1 AND deleted_at IS NULL
    `;
        const result = await this.pool.query(query, [id]);
        return result.rows[0] || null;
    }
    async getUserByEmail(email) {
        const query = `
      SELECT 
        id, 
        email, 
        first_name as "firstName", 
        last_name as "lastName", 
        password, 
        country_code as "countryCode", 
        phone, 
        role, 
        plan_id, 
        is_active as "isActive", 
        created_at as "createdAt", 
        updated_at as "updatedAt",
        deleted_at as "deletedAt"
      FROM "user"
      WHERE email = $1 AND deleted_at IS NULL
    `;
        const result = await this.pool.query(query, [email]);
        return result.rows[0] || null;
    }
    async checkEmailExists(email) {
        try {
            const query = `
        SELECT id FROM "user"
        WHERE email = $1 AND deleted_at IS NULL;
      `;
            const result = await this.pool.query(query, [email.trim()]);
            return result.rows.length > 0;
        }
        catch (error) {
            console.error('Error checking email existence:', error);
            throw new errors_1.DatabaseError('Error al verificar el email');
        }
    }
    async findByEmail(email) {
        const query = `
      SELECT id, email, password, first_name, last_name, role, is_active
      FROM "user"
      WHERE email = $1 AND deleted_at IS NULL;
    `;
        const result = await this.pool.query(query, [email]);
        return result.rows[0] || null;
    }
    async forgotPassword(email) {
        try {
            const user = await this.findByEmail(email);
            if (!user) {
                throw new errors_1.DatabaseError('No existe una cuenta con este email');
            }
            const resetToken = (0, tokenUtils_1.generateToken)();
            const tokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hora
            await this.pool.query(`UPDATE "user" SET reset_token = $1, reset_token_expiry = $2 WHERE id = $3`, [resetToken, tokenExpiry, user.id]);
            const resetUrl = `${process.env.FRONTEND_URL}/forgot-password?token=${resetToken}`;
            const html = (0, templates_1.getPasswordResetTemplate)(resetUrl);
            await (0, mailer_1.sendResetPasswordEmail)({
                to: email,
                subject: 'Recuperación de Contraseña - FinanTrack',
                html
            });
        }
        catch (error) {
            console.error('Error en forgotPassword:', error);
            throw new errors_1.DatabaseError('No se pudo enviar el correo de recuperación');
        }
    }
    async resetPassword(token, newPassword) {
        const result = await this.pool.query(`SELECT id, password, reset_token_expiry FROM "user" WHERE reset_token = $1`, [token]);
        const user = result.rows[0];
        if (!user) {
            throw new errors_1.DatabaseError('Token inválido');
        }
        if (new Date(user.reset_token_expiry) < new Date()) {
            throw new errors_1.DatabaseError('El token ha expirado');
        }
        const isSamePassword = await (0, bcryptjs_1.compare)(newPassword, user.password);
        if (isSamePassword) {
            throw new errors_1.DatabaseError('La nueva contraseña no puede ser igual a la anterior');
        }
        const hashedPassword = await (0, bcryptjs_1.hash)(newPassword, this.SALT_ROUNDS);
        await this.pool.query(`UPDATE "user"
       SET password = $1, reset_token = NULL, reset_token_expiry = NULL
       WHERE id = $2`, [hashedPassword, user.id]);
    }
    toSnakeCase(str) {
        return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    }
    generateToken(payload) {
        const jwtSecret = process.env.JWT_SECRET || 'finantrack_dev_secret_2024';
        return jsonwebtoken_1.default.sign(payload, jwtSecret, { expiresIn: '24h', algorithm: 'HS256' });
    }
}
exports.UserService = UserService;
//# sourceMappingURL=user.service.js.map