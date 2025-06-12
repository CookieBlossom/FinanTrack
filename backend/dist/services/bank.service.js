"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BankService = void 0;
const connection_1 = require("../config/database/connection");
class BankService {
    constructor() {
        this.pool = connection_1.pool;
    }
    async getAllBanks() {
        try {
            const query = `SELECT id, name FROM banks ORDER BY name;`;
            const result = await connection_1.pool.query(query);
            return result.rows;
        }
        catch (error) {
            console.error('Error SQL:', error);
            throw error;
        }
    }
}
exports.BankService = BankService;
//# sourceMappingURL=bank.service.js.map