"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashPassword = hashPassword;
exports.comparePasswords = comparePasswords;
const bcryptjs_1 = require("bcryptjs");
async function hashPassword(password) {
    const saltRounds = 10;
    return (0, bcryptjs_1.hash)(password, saltRounds);
}
async function comparePasswords(plainPassword, hashedPassword) {
    return (0, bcryptjs_1.compare)(plainPassword, hashedPassword);
}
//# sourceMappingURL=passwordUtils.js.map