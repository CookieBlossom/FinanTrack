"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlanService = void 0;
const connection_1 = require("../config/database/connection");
class PlanService {
    constructor() {
        this.pool = connection_1.pool;
    }
    async getLimitsForPlan(planId) {
        const res = await this.pool.query(`SELECT limit_key, limit_val
           FROM plan_limits
           WHERE plan_id = $1`, [planId]);
        return res.rows.reduce((map, row) => {
            map[row.limit_key] = row.limit_val;
            return map;
        }, {});
    }
    async hasPermission(planId, key) {
        const res = await this.pool.query(`SELECT 1
           FROM plan_permissions
           WHERE plan_id = $1 AND permission_key = $2`, [planId, key]);
        return res.rowCount ? res.rowCount > 0 : false;
    }
    async getAllPermissionsForPlan(planId) {
        const res = await this.pool.query(`SELECT permission_key FROM plan_permissions WHERE plan_id = $1`, [planId]);
        return res.rows.map(row => row.permission_key);
    }
    // Método de utilidad para verificar si un límite es ilimitado
    isUnlimited(limitValue) {
        return limitValue === -1;
    }
    // Método de utilidad para verificar si se puede realizar una acción
    async canPerformAction(planId, limitKey, currentCount) {
        const limits = await this.getLimitsForPlan(planId);
        const limit = limits[limitKey];
        // Si no hay límite configurado, permitir por defecto
        if (limit === undefined) {
            return true;
        }
        // Si es ilimitado (-1), siempre permitir
        if (this.isUnlimited(limit)) {
            return true;
        }
        // Verificar si no se ha excedido el límite
        return currentCount < limit;
    }
    // Método para obtener el límite restante
    async getRemainingLimit(planId, limitKey, currentCount) {
        const limits = await this.getLimitsForPlan(planId);
        const limit = limits[limitKey];
        // Si no hay límite configurado o es ilimitado, retornar -1
        if (limit === undefined || this.isUnlimited(limit)) {
            return -1;
        }
        // Retornar el límite restante
        return Math.max(0, limit - currentCount);
    }
}
exports.PlanService = PlanService;
//# sourceMappingURL=plan.service.js.map