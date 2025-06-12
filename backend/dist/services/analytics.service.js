"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsService = void 0;
const connection_1 = require("../config/database/connection");
class AnalyticsService {
    constructor() {
        this.pool = connection_1.pool;
    }
}
exports.AnalyticsService = AnalyticsService;
//# sourceMappingURL=analytics.service.js.map