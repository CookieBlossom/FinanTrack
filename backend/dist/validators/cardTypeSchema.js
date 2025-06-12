"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cardTypeUpdateSchema = exports.cardTypeSchema = void 0;
const zod_1 = require("zod");
exports.cardTypeSchema = zod_1.z.object({
    name: zod_1.z.string()
        .min(1, 'El nombre es requerido')
        .max(100, 'El nombre no puede exceder los 100 caracteres')
        .trim()
});
exports.cardTypeUpdateSchema = exports.cardTypeSchema;
//# sourceMappingURL=cardTypeSchema.js.map