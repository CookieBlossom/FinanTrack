export interface ICartola {
  // Información de la cartola
  tituloCartola: string; // Ej: "CARTOLA CUENTARUT N° 21737273"
  numero: string;
  fechaEmision: Date;
  fechaInicio: Date;
  fechaFinal: Date;
  saldoAnterior: number;
  saldoFinal: number;
  totalCargos: number;
  totalAbonos: number;
  numMovimientos: number;
  tipoCuenta: number;
  clienteNombre: string;
  clienteRut: string;
  fechaHoraConsulta: Date;
  movimientos: IMovimiento[];
}

export interface IMovimiento {
  fecha: Date;
  descripcion: string;
  abonos: number | null;
  cargos: number | null;
  numeroOperacion?: string;
  saldo?: number;
  tipo?: TipoMovimiento;
  categoria?: string;
}

export enum TipoMovimiento {
  TRANSFERENCIA_RECIBIDA = 'TRANSFERENCIA_RECIBIDA',
  TRANSFERENCIA_ENVIADA = 'TRANSFERENCIA_ENVIADA',
  COMPRA_WEB = 'COMPRA_WEB',
  COMPRA_NACIONAL = 'COMPRA_NACIONAL',
  PAGO_AUTOMATICO = 'PAGO_AUTOMATICO',
  OTRO = 'OTRO'
}

// Patrones para identificar tipos de movimientos
export const PATRONES_MOVIMIENTOS = {
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
export const PATRONES_CATEGORIAS = {
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