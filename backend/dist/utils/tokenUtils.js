"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateToken = generateToken;
const crypto_1 = require("crypto");
function generateToken() {
    return (0, crypto_1.randomBytes)(32).toString('hex');
}
//# sourceMappingURL=tokenUtils.js.map