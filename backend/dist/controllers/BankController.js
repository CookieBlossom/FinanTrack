"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BankController = void 0;
const bank_service_1 = require("../services/bank.service");
class BankController {
    constructor() {
        this.getAllBanks = async (req, res, next) => {
            try {
                const banks = await this.service.getAllBanks();
                res.json(banks);
            }
            catch (error) {
                res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
            }
        };
        this.service = new bank_service_1.BankService();
    }
}
exports.BankController = BankController;
//# sourceMappingURL=BankController.js.map