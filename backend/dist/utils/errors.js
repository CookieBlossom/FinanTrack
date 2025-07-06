"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScraperError = exports.BusinessError = exports.NotFoundError = exports.AuthenticationError = exports.ValidationError = exports.UserAlreadyExistsError = exports.DatabaseError = void 0;
exports.getErrorMessage = getErrorMessage;
class DatabaseError extends Error {
    constructor(message) {
        super(message);
        this.name = 'DatabaseError';
    }
}
exports.DatabaseError = DatabaseError;
class UserAlreadyExistsError extends Error {
    constructor(message = 'El email ya está registrado') {
        super(message);
        this.name = 'UserAlreadyExistsError';
    }
}
exports.UserAlreadyExistsError = UserAlreadyExistsError;
class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
class AuthenticationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AuthenticationError';
    }
}
exports.AuthenticationError = AuthenticationError;
class NotFoundError extends Error {
    constructor(message) {
        super(message);
        this.name = 'NotFoundError';
    }
}
exports.NotFoundError = NotFoundError;
class BusinessError extends Error {
    constructor(message) {
        super(message);
        this.name = 'BusinessError';
    }
}
exports.BusinessError = BusinessError;
function getErrorMessage(error) {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}
class ScraperError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ScraperError';
    }
}
exports.ScraperError = ScraperError;
//# sourceMappingURL=errors.js.map