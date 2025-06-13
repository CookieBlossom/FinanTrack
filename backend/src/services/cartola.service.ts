import { ICartola, IMovimiento, TipoMovimiento, PATRONES_MOVIMIENTOS, PATRONES_CATEGORIAS } from '../interfaces/ICartola';
import { DatabaseError } from '../utils/errors';
import { Pool } from 'pg';
import pdfParse from 'pdf-parse';
import { CardTypeService } from './cardType.service';
import { pool } from '../config/database/connection';
export class CartolaService {
  private pool: Pool;
  private cardTypeService: CardTypeService = new CardTypeService();
  private cardTypes: { id: number; name: string }[] = [];

  constructor() {
    this.pool = pool;
  }
  private async loadCardTypes() {
    if (this.cardTypes.length > 0) return;
      await this.cardTypeService.getAllCardTypes();
  }

  async procesarCartolaPDF(buffer: Buffer): Promise<ICartola> {
    try {
      const data = await pdfParse(buffer);
      return this.extraerDatosCartola(data.text);
    } catch (error) {
      console.error('Error al procesar PDF:', error);
      throw new Error('Error al procesar el archivo PDF de la cartola');
    }
  }
  private async extraerDatosCartola(texto: string): Promise<ICartola> {
    await this.loadCardTypes();

    const tituloCartola = this.extraerTituloCartola(texto);
    if (!tituloCartola) throw new Error('No se pudo extraer el título de la cartola');

    const tipoCuenta = this.detectCardTypeFromTitle(tituloCartola);
    if (!tipoCuenta) throw new Error('No se pudo determinar el tipo de cuenta');

    const clienteInfo = this.extraerInfoCliente(texto);
    if (!clienteInfo.clienteNombre || !clienteInfo.clienteRut || !clienteInfo.fechaHoraConsulta) {
      throw new Error('Información del cliente incompleta');
    }

    const cartolaInfo = this.extraerInfoCartola(texto);
    if (!cartolaInfo.numero || !cartolaInfo.fechaEmision || !cartolaInfo.fechaInicio || !cartolaInfo.fechaFinal) {
      throw new Error('Información de la cartola incompleta');
    }

    const movimientos = this.extraerMovimientos(texto);
    if (movimientos.length === 0) {
      throw new Error('No se encontraron movimientos en la cartola');
    }

    return {
      tituloCartola,
      numero: cartolaInfo.numero,
      fechaEmision: cartolaInfo.fechaEmision,
      fechaInicio: cartolaInfo.fechaInicio,
      fechaFinal: cartolaInfo.fechaFinal,
      saldoAnterior: cartolaInfo.saldoAnterior || 0,
      saldoFinal: cartolaInfo.saldoFinal || 0,
      totalCargos: cartolaInfo.totalCargos || 0,
      totalAbonos: cartolaInfo.totalAbonos || 0,
      numMovimientos: movimientos.length,
      tipoCuenta,
      clienteNombre: clienteInfo.clienteNombre,
      clienteRut: clienteInfo.clienteRut,
      fechaHoraConsulta: clienteInfo.fechaHoraConsulta,
      movimientos
    };
  }
  private cleanTitle(title: string): string {
    return title.toLowerCase()
      .replace(/cartola/gi, '')
      .replace(/cuenta/gi, '')
      .replace(/n[\u00ba\u00ba]?[\s\d]*/gi, '')
      .replace(/[^a-z\d ]/gi, '')
      .trim();
  }
  private extraerTituloCartola(texto: string): string | null {
    // Buscar patrones comunes de títulos de cartola
    const patrones = [
      /CARTOLA CUENTARUT N°\s*\d+/i,
      /CARTOLA CUENTA VISTA N°\s*\d+/i,
      /CARTOLA CREDITO N°\s*\d+/i,
      /CARTOLA CUENTA AHORRO N°\s*\d+/i,
      /CARTOLA.*N°\s*\d+/i  // Patrón genérico por si no coincide ninguno específico
    ];

    for (const patron of patrones) {
      const match = texto.match(patron);
      if (match) {
        return match[0].trim();
      }
    }

    return null;
  }
  private extraerInfoCliente(texto: string): Partial<ICartola> {
    // Patrones específicos para el formato de la cartola
    const patrones = [
      /Cliente\s*Nombre\s*RUT\s*Fecha y Hora\s*([^\n]+?)\s+(\d{1,2}\.\d{3}\.\d{3}-[\dkK])\s+(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})/i,
      /(?:Cliente|Nombre)[^\n]*\n\s*([^\n]+?)\s+(\d{1,2}\.\d{3}\.\d{3}-[\dkK])\s+(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})/i,
      /([^\n]+?)\s+(\d{1,2}\.\d{3}\.\d{3}-[\dkK])\s+(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})/i
    ];
    for (const patron of patrones) {
      const match = texto.match(patron);
      if (match) {
        const clienteNombre = match[1].trim();
        const clienteRut = match[2];
        const fechaHora = match[3];
        
        // Convertir la fecha y hora
        const [fecha, hora] = fechaHora.split(' ');
        const fechaHoraConsulta = new Date(this.convertirFecha(fecha));
        const [horas, minutos] = hora.split(':');
        fechaHoraConsulta.setHours(parseInt(horas), parseInt(minutos));

        return {
          clienteNombre,
          clienteRut,
          fechaHoraConsulta
        };
      }
    }
    const nombreMatch = texto.match(/(?:Cliente|Nombre)[^\n]*\n\s*([^\n]+)/i);
    const rutMatch = this.extraerRut(texto);
    const fechaHoraMatch = texto.match(/(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})/);

    if (nombreMatch) {
      return {
        clienteNombre: nombreMatch[1].trim(),
        clienteRut: rutMatch || 'No especificado',
        fechaHoraConsulta: fechaHoraMatch ? new Date(this.convertirFecha(fechaHoraMatch[1])) : new Date()
      };
    }

    throw new Error('No se pudo extraer la información del cliente');
  }
  private extraerRut(texto: string): string | null {
    const patronesRut = [
      /\b(\d{1,2}\.?\d{3}\.?\d{3}-[\dkK])\b/,
      /RUT:?\s*(\d{1,2}\.?\d{3}\.?\d{3}-[\dkK])/i,
      /R\.U\.T\.?:?\s*(\d{1,2}\.?\d{3}\.?\d{3}-[\dkK])/i
    ];

    for (const patron of patronesRut) {
      const match = texto.match(patron);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  private extraerInfoCartola(texto: string): Partial<ICartola> {
    // Patrones más flexibles para la información de la cartola
    const patronesCartola = [
      /N°\s*(?:Cartola|Estado)?\s*(?:N°)?\s*(\d+)/i,
      /Cartola\s*N°\s*(\d+)/i,
      /Estado\s*de\s*Cuenta\s*N°\s*(\d+)/i
    ];

    const patronesFecha = [
      /Fecha\s*(?:de)?\s*Emisión\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i,
      /Emitido\s*(?:el)?\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i,
      /Fecha\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i
    ];

    const patronesPeriodo = [
      /Fecha\s*Inicio\s*:?\s*(\d{2}\/\d{2}\/\d{4})\s*(?:Fecha)?\s*Final\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i,
      /Período\s*:?\s*(?:del)?\s*(\d{2}\/\d{2}\/\d{4})\s*(?:al|hasta)\s*(\d{2}\/\d{2}\/\d{4})/i
    ];

    const patronesSaldos = [
      /Saldo\s*Anterior\s*:?\s*\$\s*([\d,.]+)\s*.*Saldo\s*Final\s*:?\s*\$\s*([\d,.]+)/s,
      /Saldo\s*Inicial\s*:?\s*\$\s*([\d,.]+)\s*.*Saldo\s*(?:al\s*cierre|final)\s*:?\s*\$\s*([\d,.]+)/s
    ];

    const patronesTotales = [
      /Total\s*(?:Giros|Cargos)\s*:?\s*\$\s*([\d,.]+)\s*.*Total\s*(?:Depósitos|Abonos)\s*:?\s*\$\s*([\d,.]+)/s,
      /(?:Giros|Cargos)\s*:?\s*\$\s*([\d,.]+)\s*.*(?:Depósitos|Abonos)\s*:?\s*\$\s*([\d,.]+)/s
    ];

    let numero: string | null = null;
    let fechaEmision: Date | null = null;
    let fechaInicio: Date | null = null;
    let fechaFinal: Date | null = null;
    let saldoAnterior: number | null = null;
    let saldoFinal: number | null = null;
    let totalCargos: number | null = null;
    let totalAbonos: number | null = null;

    // Buscar número de cartola
    for (const patron of patronesCartola) {
      const match = texto.match(patron);
      if (match) {
        numero = match[1];
        break;
      }
    }

    // Buscar fecha de emisión
    for (const patron of patronesFecha) {
      const match = texto.match(patron);
      if (match) {
        fechaEmision = new Date(this.convertirFecha(match[1]));
        break;
      }
    }

    // Buscar período
    for (const patron of patronesPeriodo) {
      const match = texto.match(patron);
      if (match) {
        fechaInicio = new Date(this.convertirFecha(match[1]));
        fechaFinal = new Date(this.convertirFecha(match[2]));
        break;
      }
    }

    // Buscar saldos
    for (const patron of patronesSaldos) {
      const match = texto.match(patron);
      if (match) {
        saldoAnterior = this.convertirMonto(match[1]);
        saldoFinal = this.convertirMonto(match[2]);
        break;
      }
    }

    // Buscar totales
    for (const patron of patronesTotales) {
      const match = texto.match(patron);
      if (match) {
        totalCargos = this.convertirMonto(match[1]);
        totalAbonos = this.convertirMonto(match[2]);
        break;
      }
    }

    // Si no encontramos alguna fecha, usar la fecha actual
    const fechaActual = new Date();
    if (!fechaEmision) fechaEmision = fechaActual;
    if (!fechaInicio) fechaInicio = fechaActual;
    if (!fechaFinal) fechaFinal = fechaActual;

    // Si no encontramos algún monto, usar 0
    if (saldoAnterior === null) saldoAnterior = 0;
    if (saldoFinal === null) saldoFinal = 0;
    if (totalCargos === null) totalCargos = 0;
    if (totalAbonos === null) totalAbonos = 0;

    // Si no encontramos número de cartola, generar uno
    if (!numero) {
      numero = fechaEmision.getTime().toString();
    }

    return {
      numero,
      fechaEmision,
      fechaInicio,
      fechaFinal,
      saldoAnterior,
      saldoFinal,
      totalCargos,
      totalAbonos
    };
  }

  /**
   * Extrae los movimientos de la cartola
   */
  private extraerMovimientos(texto: string): IMovimiento[] {
    const movimientos: IMovimiento[] = [];
    
    // Agregar logs para depuración
    console.log('Texto completo:', texto);
    
    // Buscar la sección de movimientos
    const posiblesInicios = [
      'Detalle de movimientos:',
      'Detalle de Movimientos',
      'Movimientos',
      'Fecha N°'
    ];

    let inicioMovimientos = -1;
    let textoMovimientos = texto;

    for (const inicio of posiblesInicios) {
      inicioMovimientos = texto.indexOf(inicio);
      if (inicioMovimientos !== -1) {
        console.log('Sección de movimientos encontrada con:', inicio);
        textoMovimientos = texto.substring(inicioMovimientos);
        break;
      }
    }

    if (inicioMovimientos === -1) {
      console.log('No se encontró la sección de movimientos');
      return movimientos;
    }

    // Normalizar el texto: reemplazar múltiples espacios y saltos de línea con un solo espacio
    textoMovimientos = textoMovimientos
      .replace(/\n+/g, ' ')  // Reemplazar saltos de línea con espacios
      .replace(/\s+/g, ' ')  // Normalizar espacios múltiples
      .trim();

    console.log('Texto de movimientos normalizado:', textoMovimientos);
    
    // Patrón actualizado para el formato específico
    const regexMovimientos = /(\d{2}\/[A-Za-z]{3})\s*(\d+)\s*([^$]+?)(?:\$\s*([\d,.]+))?\s*(?:\$\s*([\d,.]+))?\s*\$\s*([\d,.]+)/g;
    
    let match;
    while ((match = regexMovimientos.exec(textoMovimientos)) !== null) {
      console.log('Match encontrado:', match);
      
      const descripcion = match[3].trim();
      const abono = match[4] ? this.convertirMonto(match[4]) : null;
      const cargo = match[5] ? this.convertirMonto(match[5]) : null;
      
      // Validar que la descripción no sea un encabezado
      if (descripcion.toUpperCase().includes('DESCRIPCIÓN') || 
          descripcion.toUpperCase().includes('OPERACIÓN') ||
          descripcion.toUpperCase().includes('SUBTOTALES')) {
        continue;
      }
      
      const movimiento: IMovimiento = {
        fecha: new Date(this.convertirFecha(match[1])),
        numeroOperacion: match[2],
        descripcion: descripcion,
        abonos: abono,
        cargos: cargo,
        saldo: this.convertirMonto(match[6]),
        tipo: this.determinarTipoMovimiento(descripcion),
        categoria: this.determinarCategoria(descripcion)
      };

      console.log('Movimiento procesado:', movimiento);
      movimientos.push(movimiento);
    }

    console.log('Total de movimientos encontrados:', movimientos.length);
    return movimientos;
  }

  /**
   * Convierte una fecha del formato "dd/MMM" a una fecha completa
   */
  private convertirFecha(fecha: string): string {
    if (!fecha) return '';

    if (fecha.includes('/')) {
      // Si ya viene en formato dd/mm/yyyy
      if (fecha.split('/').length === 3) {
        const [dia, mes, año] = fecha.split('/');
        return `${año}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
      }
      
      // Para fechas en formato dd/MMM
      const [dia, mes] = fecha.split('/');
      const meses: { [key: string]: string } = {
        'Ene': '01', 'Feb': '02', 'Mar': '03', 'Abr': '04',
        'May': '05', 'Jun': '06', 'Jul': '07', 'Ago': '08',
        'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dic': '12'
      };
      
      // Extraer el año del título de la cartola o usar el año actual
      const añoActual = new Date().getFullYear();
      return `${añoActual}-${meses[mes]}-${dia.padStart(2, '0')}`;
    }
    return fecha;
  }
  private formatearFechaParaDB(fecha: Date): string {
    if (!(fecha instanceof Date) || isNaN(fecha.getTime())) {
      // Si la fecha no es válida, usar la fecha actual
      fecha = new Date();
    }
    return fecha.toISOString();
  }
  private convertirMonto(monto: string): number {
    if (!monto) return 0;
    // Eliminar el símbolo de peso y los puntos, reemplazar la coma por punto
    return parseFloat(monto.replace(/[$\s.]/g, '').replace(',', '.'));
  }
  private determinarTipoMovimiento(descripcion: string): TipoMovimiento {
    const descripcionUpper = descripcion.toUpperCase();
    
    if (descripcionUpper.includes('TEF DE') || descripcionUpper.includes('TRANSFERENCIA DE')) {
      return TipoMovimiento.TRANSFERENCIA_RECIBIDA;
    }
    if (descripcionUpper.includes('TEF A') || descripcionUpper.includes('TRANSFERENCIA A')) {
      return TipoMovimiento.TRANSFERENCIA_ENVIADA;
    }
    if (descripcionUpper.includes('COMPRA WEB')) {
      return TipoMovimiento.COMPRA_WEB;
    }
    if (descripcionUpper.includes('COMPRA NACIONAL')) {
      return TipoMovimiento.COMPRA_NACIONAL;
    }
    if (descripcionUpper.includes('PAGO AUTOMATICO') || descripcionUpper.includes('PAGO DEUDA')) {
      return TipoMovimiento.PAGO_AUTOMATICO;
    }
    
    return TipoMovimiento.OTRO;
  }
  private determinarCategoria(descripcion: string): string | undefined {
    const descripcionUpper = descripcion.toUpperCase();
    if (descripcionUpper.includes('MCDONALDS')) return 'COMIDA_RAPIDA';
    if (descripcionUpper.includes('PEDIDOSYA')) return 'DELIVERY';
    if (descripcionUpper.includes('GOOGLE PLAY') || descripcionUpper.includes('YOUTUBE')) return 'SUSCRIPCIONES';
    if (descripcionUpper.includes('PASAJE') || descripcionUpper.includes('TRANSPORTE')) return 'TRANSPORTE';
    if (descripcionUpper.includes('RIOT GAMES') || descripcionUpper.includes('GAMECLUB')) return 'JUEGOS';
    if (descripcionUpper.includes('BEAUTY') || descripcionUpper.includes('BODY SHO')) return 'CUIDADO_PERSONAL';
    if (descripcionUpper.includes('TEF DE') || descripcionUpper.includes('TRANSFERENCIA DE')) return 'INGRESO';
    if (descripcionUpper.includes('TEF A') || descripcionUpper.includes('TRANSFERENCIA A')) return 'TRANSFERENCIA';
    if (descripcionUpper.includes('COMPRA WEB')) return 'COMPRA_ONLINE';
    if (descripcionUpper.includes('COMPRA NACIONAL')) return 'COMPRA_PRESENCIAL';
    return undefined;
  }
  async guardarMovimientos(cardId: number, movimientos: IMovimiento[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const movimiento of movimientos) {
        const amount = movimiento.abonos || -movimiento.cargos!;
        const movementType = movimiento.abonos ? 'income' : 'expense';
        const fechaMovimiento = this.formatearFechaParaDB(movimiento.fecha);
        await client.query(
          `INSERT INTO movements (
            card_id,
            amount,
            description,
            movement_type,
            movement_source,
            transaction_date,
            category,
            metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            cardId,
            amount,
            movimiento.descripcion,
            movementType,
            'cartola',
            fechaMovimiento,
            movimiento.categoria,
            { 
              numeroOperacion: movimiento.numeroOperacion,
              saldo: movimiento.saldo,
              tipo: movimiento.tipo
            }
          ]
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  private detectCardTypeFromTitle(title: string): number {
    const normalizedTitle = this.cleanTitle(title);
    for (const { id, name } of this.cardTypes) {
      const normalizedName = name.toLowerCase().replace(/[^a-z\d ]/gi, '').trim();
      if (normalizedTitle.includes(normalizedName)) {
        return id;
      }
    }
    const other = this.cardTypes.find((ct) => ct.name.toLowerCase() === 'otros');
    return other ? other.id : -1;
  }
} 
