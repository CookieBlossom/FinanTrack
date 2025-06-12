"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PATRONES_CATEGORIAS = exports.PATRONES_MOVIMIENTOS = exports.TipoMovimiento = void 0;
var TipoMovimiento;
(function (TipoMovimiento) {
    TipoMovimiento["TRANSFERENCIA_RECIBIDA"] = "TRANSFERENCIA_RECIBIDA";
    TipoMovimiento["TRANSFERENCIA_ENVIADA"] = "TRANSFERENCIA_ENVIADA";
    TipoMovimiento["COMPRA_WEB"] = "COMPRA_WEB";
    TipoMovimiento["COMPRA_NACIONAL"] = "COMPRA_NACIONAL";
    TipoMovimiento["PAGO_AUTOMATICO"] = "PAGO_AUTOMATICO";
    TipoMovimiento["OTRO"] = "OTRO";
})(TipoMovimiento || (exports.TipoMovimiento = TipoMovimiento = {}));
// Patrones para identificar tipos de movimientos
exports.PATRONES_MOVIMIENTOS = {
    TRANSFERENCIA_RECIBIDA: [
        'TEF DE',
        'TRANSFERENCIA ELECTRONICA DE FONDOS',
        'TRANSFERENCIA DE'
    ],
    TRANSFERENCIA_ENVIADA: [
        'TEF A'
    ],
    COMPRA_WEB: [
        'COMPRA WEB'
    ],
    COMPRA_NACIONAL: [
        'COMPRA NACIONAL'
    ],
    PAGO_AUTOMATICO: [
        'PAGO AUTOMATICO',
        'PAGO DEUDA'
    ]
};
// Patrones para categorización automática
exports.PATRONES_CATEGORIAS = {
    'Alimentación': [
        'PEDIDOSYA',
        'MCDONALDS',
        'RESTAURANT',
        'DELIVERY'
    ],
    'Entretenimiento': [
        'GOOGLE PLAY',
        'RIOT GAMES',
        'STEAM',
        'YOUTUBE',
        'SPOTIFY',
        'NETFLIX'
    ],
    'Compras': [
        'TEMU',
        'BEAUTY MARKET',
        'MARKET',
        'SHOP',
        'STORE'
    ],
    'Transporte': [
        'PASAJE QR',
        'UBER',
        'CABIFY',
        'DIDI',
        'METRO'
    ]
};
//# sourceMappingURL=ICartola.js.map