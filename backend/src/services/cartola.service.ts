import { ICartola, IMovimiento, TipoMovimiento, PATRONES_MOVIMIENTOS, PATRONES_CATEGORIAS } from '../interfaces/ICartola';
import { DatabaseError } from '../utils/errors';
import { Pool } from 'pg';
import pdfParse from 'pdf-parse';
import { CardTypeService } from './cardType.service';
import { PlanService } from './plan.service';
import { pool } from '../config/database/connection';
import companies from '../config/companies.json';

export class CartolaService {
  private pool: Pool;
  private cardTypeService: CardTypeService = new CardTypeService();
  private planService: PlanService = new PlanService();
  private cardTypes: { id: number; name: string }[] = [];
  private lastProcessedText: string | null = null;

  constructor() {
    this.pool = pool;
  }

  // Verificar límites de procesamiento de cartolas
  private async checkCartolaLimits(userId: number, planId: number): Promise<void> {
    const limits = await this.planService.getLimitsForPlan(planId);
    const maxCartolas = limits.monthly_cartolas || 0; // Por defecto 0 si no está definido

    if (maxCartolas === -1) {
      return; // Ilimitado
    }

    const currentMonth = new Date();
    const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    
    const cartolaCountQuery = `
      SELECT COUNT(*) as count 
      FROM movements 
      WHERE movement_source = 'cartola' 
      AND card_id IN (SELECT id FROM cards WHERE user_id = $1)
      AND transaction_date >= $2
    `;
    const result = await this.pool.query(cartolaCountQuery, [userId, startOfMonth]);
    const currentCount = parseInt(result.rows[0].count);

    if (currentCount >= maxCartolas) {
      throw new DatabaseError(`Has alcanzado el límite de ${maxCartolas} cartolas procesadas por mes para tu plan.`);
    }
  }

  // Verificar permisos de importación de cartolas
  private async checkCartolaPermission(planId: number): Promise<void> {
    const hasPermission = await this.planService.hasPermission(planId, 'cartola_upload');
    if (!hasPermission) {
      throw new DatabaseError('Tu plan no incluye la funcionalidad de importación de cartolas.');
    }
  }

  private async loadCardTypes() {
    if (this.cardTypes.length > 0) return;
      await this.cardTypeService.getAllCardTypes();
  }

  async procesarCartolaPDF(buffer: Buffer): Promise<ICartola> {
    try {
      console.log("🔍 Iniciando procesamiento de PDF...");
      const data = await pdfParse(buffer);
      console.log("📄 Texto extraído del PDF:", data.text.substring(0, 500) + "...");
      return this.extraerDatosCartola(data.text);
    } catch (error) {
      console.error('❌ Error al procesar PDF:', error);
      throw new Error('Error al procesar el archivo PDF de la cartola');
    }
  }
  private async extraerDatosCartola(texto: string): Promise<ICartola> {
    console.log("🔍 Iniciando extracción de datos de la cartola...");
    
    // Almacenar el texto para uso en otras funciones
    this.lastProcessedText = texto;
    
    await this.loadCardTypes();

    const tituloCartola = this.extraerTituloCartola(texto);
    console.log("📌 Título de cartola encontrado:", tituloCartola);
    if (!tituloCartola) throw new Error('No se pudo extraer el título de la cartola');

    const tipoCuenta = this.detectCardTypeFromTitle(tituloCartola);
    console.log("💳 Tipo de cuenta detectado:", tipoCuenta);
    if (!tipoCuenta) throw new Error('No se pudo determinar el tipo de cuenta');

    const clienteInfo = this.extraerInfoCliente(texto);
    console.log("👤 Información del cliente:", clienteInfo);
    if (!clienteInfo.clienteNombre || !clienteInfo.clienteRut || !clienteInfo.fechaHoraConsulta) {
      throw new Error('Información del cliente incompleta');
    }

    const cartolaInfo = this.extraerInfoCartola(texto);
    console.log("📊 Información de la cartola:", cartolaInfo);
    if (!cartolaInfo.numero || !cartolaInfo.fechaEmision || !cartolaInfo.fechaInicio || !cartolaInfo.fechaFinal) {
      throw new Error('Información de la cartola incompleta');
    }
    const movimientos = this.extraerMovimientos(texto, cartolaInfo.fechaInicio!, cartolaInfo.fechaFinal!);
    console.log(`📝 Movimientos extraídos: ${movimientos.length}`);
    if (movimientos.length === 0) {
      console.log("❌ No se encontraron movimientos. Texto de la cartola:", texto);
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
    // Buscar el título de la cartola
    const patronTitulo = /CARTOLA\s+(CUENTARUT|CUENTA\s+VISTA|CUENTA\s+AHORRO|CREDITO)\s+N°\s*(\d+)/i;
    const match = texto.match(patronTitulo);
    
    if (match) {
      const tipoTarjeta = match[1].replace(/\s+/g, '').toUpperCase();
      const numeroCuenta = match[2];

      // Determinar el tipo de cuenta
      let tipoCuenta = '';
      switch (tipoTarjeta) {
        case 'CUENTARUT':
          tipoCuenta = 'CuentaRUT';
          break;
        case 'CUENTAVISTA':
          tipoCuenta = 'Cuenta Vista';
          break;
        case 'CUENTAAHORRO':
          tipoCuenta = 'Cuenta Ahorro';
          break;
        case 'CREDITO':
          tipoCuenta = 'Tarjeta de Crédito';
          break;
        default:
          tipoCuenta = 'Cuenta';
      }

      // Para CuentaRUT, formatear el número como RUT
      if (tipoTarjeta === 'CUENTARUT') {
        // Primero intentar obtener el RUT completo del cliente
        const rutCliente = this.extraerRut(texto);
        if (rutCliente) {
          return `${tipoCuenta} - ${rutCliente}`;
        }
        
        // Si no se puede extraer el RUT completo, formatear el número de cuenta como RUT
        // Asumir que el número de cuenta es el RUT sin puntos ni guión
        if (numeroCuenta.length >= 8) {
          // Agregar el dígito verificador típico (esto es una aproximación)
          // En un caso real, necesitaríamos calcular o extraer el DV correcto
          const rutFormateado = this.formatearRutFromNumber(numeroCuenta);
          return `${tipoCuenta} - ${rutFormateado}`;
        }
      }

      return `${tipoCuenta} - ${numeroCuenta}`;
    }

    return 'Cuenta Bancaria';
  }

  private formatearRutFromNumber(numero: string): string {
    // Para un número como "21737273", formatearlo como RUT
    
    // Si el número tiene exactamente 8 dígitos, probablemente incluye el DV
    if (numero.length === 8) {
      const cuerpo = numero.slice(0, -1); // 2173727
      const dv = numero.slice(-1); // 3
      return cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + dv;
    }
    
    // Si tiene 7 o más dígitos, buscar el RUT completo en el texto
    if (this.lastProcessedText && numero.length >= 7) {
      // Buscar el RUT formateado en el texto usando el número
      const numeroSinFormato = numero.replace(/[.-]/g, '');
      const patronCompleto = new RegExp(`(${numeroSinFormato.slice(0, -1) || numeroSinFormato})[-]?([0-9kK])`, 'i');
      const match = this.lastProcessedText.match(patronCompleto);
      
      if (match) {
        const cuerpo = match[1];
        const dv = match[2].toUpperCase();
        return cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + dv;
      }
      
      // También buscar el RUT ya formateado
      const patronFormateado = new RegExp(`\\b(\\d{1,2}\\.\\d{3}\\.\\d{3}[-][0-9kK])\\b`, 'gi');
      const matchesFormateados = this.lastProcessedText.match(patronFormateado);
      
      if (matchesFormateados) {
        // Buscar el que coincida con nuestro número
        for (const rutFormateado of matchesFormateados) {
          const rutSinFormato = rutFormateado.replace(/[.-]/g, '');
          if (rutSinFormato.startsWith(numeroSinFormato.slice(0, -1)) || rutSinFormato.includes(numeroSinFormato)) {
            return rutFormateado;
          }
        }
      }
    }
    
    // Fallback: formatear con puntos
    if (numero.length >= 7) {
      const cuerpo = numero.slice(0, -1);
      const dv = numero.slice(-1);
      return cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + dv;
    }
    
    // Fallback final: formatear con puntos y asumir DV como 'K'
    return numero.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-K';
  }

  private extraerInfoCliente(texto: string): Partial<ICartola> {
    // Patrones más específicos para extraer nombre y RUT
    const patronesCliente = [
      // Patrón para formato CuentaRUT específico
      /(?:Nombre\s+RUT\s+Fecha[^\n]*\n\s*)([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]+)\s+(\d{1,2}\.?\d{3}\.?\d{3}-[\dkK])/i,
      // Patrón para formato "NOMBRE APELLIDO RUT 12.345.678-9"
      /([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]+)(?:\s+)?(\d{1,2}\.?\d{3}\.?\d{3}-[\dkK])/i,
      // Patrón para formato "Cliente: NOMBRE APELLIDO RUT: 12.345.678-9"
      /Cliente:?\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]+)(?:\s+)?(?:RUT|R\.U\.T\.?):?\s*(\d{1,2}\.?\d{3}\.?\d{3}-[\dkK])/i,
      // Patrón para formato "RUT: 12.345.678-9 NOMBRE APELLIDO"
      /(?:RUT|R\.U\.T\.?):?\s*(\d{1,2}\.?\d{3}\.?\d{3}-[\dkK])\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]+)/i
    ];
    
    // Buscar después de "Cliente" y antes de cualquier otro encabezado
    const bloqueCliente = texto.match(/Cliente\s*([\s\S]*?)(?=(?:Movimientos|Detalle|Saldo|Fecha))/i);
    
    if (bloqueCliente) {
      const lineas = bloqueCliente[1].split('\n')
        .map(l => l.trim())
        .filter(l => l && !l.match(/^(?:Nombre|RUT|Fecha\s+y\s+Hora)$/i)); // Ignorar líneas de encabezado

      // Buscar en cada línea con cada patrón
      for (const linea of lineas) {
        for (const patron of patronesCliente) {
          const match = linea.match(patron);
          if (match) {
            let nombreCompleto, rut;
            
            // Si el patrón tiene el RUT primero
            if (match[1].match(/^\d/)) {
              rut = match[1];
              nombreCompleto = match[2];
            } else {
              nombreCompleto = match[1];
              rut = match[2];
            }
            
            // Limpiar y formatear el nombre
            nombreCompleto = nombreCompleto
              .trim()
              .replace(/\s+/g, ' ')
              .toUpperCase();
            
            // Formatear el RUT
            rut = this.formatearRut(rut);
            
            // Buscar la fecha y hora con el formato específico
            const fechaHoraMatch = texto.match(/(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})/);
            const fechaHora = fechaHoraMatch ? new Date(this.convertirFecha(fechaHoraMatch[1])) : new Date();
            
            return {
              clienteNombre: nombreCompleto,
              clienteRut: rut,
              fechaHoraConsulta: fechaHora
            };
          }
        }
      }
    }

    // Si no se encontró la información, intentar buscar por separado
    const rutSolo = this.extraerRut(texto);
    const nombreSolo = this.extraerNombre(texto);

    if (rutSolo || nombreSolo) {
      return {
        clienteNombre: nombreSolo || 'NO ESPECIFICADO',
        clienteRut: rutSolo || 'NO ESPECIFICADO',
        fechaHoraConsulta: new Date()
      };
    }

    throw new Error('No se pudo extraer la información del cliente');
  }

  private extraerRut(texto: string): string | null {
    const patronesRut = [
      // Patrón específico para el formato que mostró el usuario: "VEGA SOTO MARIA JESUS21.737.273-908/06/2025"
      /([A-ZÁÉÍÓÚÑ\s]+)(\d{1,2}\.\d{3}\.\d{3}-[\dkK])(\d{2}\/\d{2}\/\d{4})/i,
      // Patrón específico para CuentaRUT
      /(?:Nombre\s+RUT\s+Fecha[^\n]*\n\s*)[A-ZÁÉÍÓÚÑ\s]+(\d{1,2}\.?\d{3}\.?\d{3}-[\dkK])/i,
      // Patrón para RUT en el título de la cartola
      /CARTOLA\s+CUENTARUT\s+N°\s*(\d{1,2}\.?\d{3}\.?\d{3})/i,
      // Patrones generales
      /\b(\d{1,2}\.?\d{3}\.?\d{3}-[\dkK])\b/,
      /RUT:?\s*(\d{1,2}\.?\d{3}\.?\d{3}-[\dkK])/i,
      /R\.U\.T\.?:?\s*(\d{1,2}\.?\d{3}\.?\d{3}-[\dkK])/i,
      /CLIENTE:?\s*(?:[A-ZÁÉÍÓÚÑ\s]+)?\s*(\d{1,2}\.?\d{3}\.?\d{3}-[\dkK])/i
    ];

    for (let i = 0; i < patronesRut.length; i++) {
      const patron = patronesRut[i];
      const match = texto.match(patron);
      if (match) {
        let rutCapturado;
        
        // Para el primer patrón específico, el RUT está en el grupo 2
        if (i === 0) {
          rutCapturado = match[2];
        } else {
          rutCapturado = match[1];
        }
        
        return this.formatearRut(rutCapturado);
      }
    }

    return null;
  }

  private extraerNombre(texto: string): string | null {
    const patronesNombre = [
      // Patrón específico para CuentaRUT
      /(?:Nombre\s+RUT\s+Fecha[^\n]*\n\s*)([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]+)(?=\s+\d{1,2}\.?\d{3}\.?\d{3}-[\dkK])/i,
      // Patrones generales
      /Cliente:?\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]+?)(?=\s+\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]|$)/i,
      /Titular:?\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]+?)(?=\s+(?:RUT|R\.U\.T\.?)|$)/i,
      /(?:RUT|R\.U\.T\.?):?\s*(?:\d{1,2}\.?\d{3}\.?\d{3}-[\dkK])\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]+)/i
    ];

    for (const patron of patronesNombre) {
      const match = texto.match(patron);
      if (match) {
        return match[1].trim().replace(/\s+/g, ' ').toUpperCase();
      }
    }

    return null;
  }

  private formatearRut(rut: string): string {
    // Eliminar puntos y guiones
    let rutLimpio = rut.replace(/[.-]/g, '');
    
    // Separar cuerpo y dígito verificador
    const cuerpo = rutLimpio.slice(0, -1);
    const dv = rutLimpio.slice(-1).toUpperCase();
    
    // Formatear con puntos y guión
    return cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + dv;
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
  private extraerMovimientos(texto: string, fechaInicio: Date, fechaFinal: Date): IMovimiento[] {
    const movimientos: IMovimiento[] = [];
    console.log("🔍 Iniciando extracción de movimientos...");
    
    // 1) Encontrar el bloque de movimientos
    const bloqueMatch = texto.match(/Detalle de movimientos:[\s\S]*?(?=Subtotales|$)/i);
    if (!bloqueMatch) {
      console.log("❌ No se encontró el bloque de movimientos");
      return movimientos;
    }
    
    const bloque = bloqueMatch[0];
    console.log("✅ Bloque de movimientos encontrado");
    
    // 2) Dividir en líneas y limpiar
    const lineas = bloque
      .split('\n')
      .map(linea => linea.trim())
      .filter(linea => linea && !linea.startsWith('Detalle de movimientos') && !linea.match(/^FechaN|^Operación|^Descripción/i));
    
    // 3) Agrupar líneas por movimiento
    const movimientosTexto: string[] = [];
    let movimientoActual: string[] = [];
    const patronFecha = /^(\d{2}\/[A-Za-z]{3})/;
    
    for (const linea of lineas) {
      if (patronFecha.test(linea)) {
        // Si encontramos una nueva fecha y ya teníamos un movimiento en proceso
        if (movimientoActual.length > 0) {
          movimientosTexto.push(movimientoActual.join('\n'));
          movimientoActual = [];
        }
        movimientoActual.push(linea);
      } else if (movimientoActual.length > 0) {
        movimientoActual.push(linea);
      }
    }
    
    // Agregar el último movimiento
    if (movimientoActual.length > 0) {
      movimientosTexto.push(movimientoActual.join('\n'));
    }
    
    // 4) Procesar cada movimiento agrupado
    for (const movimientoTexto of movimientosTexto) {
      const lineasMovimiento = movimientoTexto.split('\n');
      const primeraLinea = lineasMovimiento[0];
      const matchFecha = primeraLinea.match(patronFecha);
      
      if (matchFecha) {
        const fecha = matchFecha[1];
        const restoLinea = primeraLinea.substring(matchFecha[0].length).trim();
        
        // Extraer número de operación
        const numeroOperacion = restoLinea.split(/\s+/)[0];
        
        // Unir todas las líneas y buscar montos
        let textoCompleto = lineasMovimiento.join(' ').trim();
        
        // Buscar montos al final del texto
        const montosMatch = textoCompleto.match(/\$[\d,.]+(?:\s*\$[\d,.]+)*$/);
        let descripcion = textoCompleto;
        let montos: string[] = [];
        
        if (montosMatch) {
          // Extraer la parte de montos y limpiar la descripción
          montos = montosMatch[0].split('$').filter(Boolean).map(m => m.trim());
          descripcion = textoCompleto.substring(0, montosMatch.index).trim();
        }
        
        // Extraer la descripción sin el número de operación
        descripcion = descripcion.substring(numeroOperacion.length).trim();
        descripcion = descripcion.replace(/\s+/g, ' ').trim();
        
        // Procesar montos
        let abonos: number | null = null;
        let cargos: number | null = null;
        let saldo: number | undefined;
        
        // El último monto siempre es el saldo
        if (montos.length > 0) {
          saldo = this.convertirMonto(montos[montos.length - 1]);
          
          // Si hay más montos, determinar si son cargos o abonos
          if (montos.length > 1) {
            const monto = this.convertirMonto(montos[0]);
            
            // Determinar si es cargo o abono basado en la descripción y el saldo
            if (descripcion.match(/COMPRA|GIRO|PAGO|TEF A|TRANSFERENCIA A/i)) {
              cargos = monto;
            } else if (descripcion.match(/TEF DE|TRANSFERENCIA DE|DEPOSITO|ABONO/i)) {
              abonos = monto;
            } else {
              // Si no podemos determinar por la descripción, usar el saldo
              if (saldo !== undefined && monto !== undefined) {
                if (saldo > monto) {
                  cargos = monto;
                } else {
                  abonos = monto;
                }
              }
            }
          }
        }
        
        const movimiento: IMovimiento = {
          fecha: this.parseFechaContextual(fecha, fechaInicio, fechaFinal),
          numeroOperacion,
          descripcion,
          abonos,
          cargos,
          saldo,
          tipo: this.determinarTipoMovimiento(descripcion, abonos !== null)
        };
        
        console.log("Movimiento procesado:", movimiento);
        movimientos.push(movimiento);
      }
    }
    
    return movimientos;
  }
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
  private parseFechaContextual(fecha: string, fechaInicio: Date, fechaFinal: Date): Date {
    try {
      // Primero limpiamos la fecha de cualquier texto adicional
      const fechaLimpia = fecha.split(/[^0-9/A-Za-z]/)[0];
      const [dd, MMM] = fechaLimpia.split('/');
      
      const mesesMap: Record<string, number> = {
        'Ene': 0, 'Feb': 1, 'Mar': 2, 'Abr': 3,
        'May': 4, 'Jun': 5, 'Jul': 6, 'Ago': 7,
        'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dic': 11
      };
      
      const mes = mesesMap[MMM];
      if (mes === undefined) {
        console.error(`Mes inválido en fecha "${fecha}", usando fecha actual`);
        return new Date();
      }
      
      // Determinar el año correcto basándose en el período de la cartola
      // Esto resuelve el problema de cartolas que cruzan años (ej: 02/12/2024 → 03/01/2025)
      const añoInicio = fechaInicio.getFullYear();
      const añoFinal = fechaFinal.getFullYear();
      const mesInicio = fechaInicio.getMonth();
      const mesFinal = fechaFinal.getMonth();
      
      let añoMovimiento = añoFinal; // Por defecto usar el año final
      
      // Si la cartola cruza años (ej: dic 2024 - ene 2025)
      if (añoInicio !== añoFinal) {
        // Si el mes del movimiento pertenece al período del año inicial (ej: diciembre)
        if (mes >= mesInicio) {
          añoMovimiento = añoInicio; // Usar 2024 para movimientos de diciembre
        }
        // Si el mes del movimiento pertenece al período del año final (ej: enero)
        else if (mes <= mesFinal) {
          añoMovimiento = añoFinal; // Usar 2025 para movimientos de enero
        }
      }
      
      const nuevaFecha = new Date(añoMovimiento, mes, parseInt(dd, 10));
      if (isNaN(nuevaFecha.getTime())) {
        console.error(`Fecha inválida generada para "${fecha}", usando fecha actual`);
        return new Date();
      }
      
      console.log(`📅 Fecha procesada: ${fecha} → ${nuevaFecha.toISOString().substring(0, 10)} (año determinado: ${añoMovimiento})`);
      return nuevaFecha;
    } catch (error) {
      console.error(`Error al parsear fecha "${fecha}":`, error);
      return new Date();
    }
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
  private determinarTipoMovimiento(descripcion: string, esAbono: boolean): TipoMovimiento {
    const descripcionUpper = descripcion.toUpperCase();
    
    // Si es un abono (ingreso)
    if (esAbono) {
      if (descripcionUpper.includes('TEF DE') || descripcionUpper.includes('TRANSFERENCIA DE')) {
        return TipoMovimiento.TRANSFERENCIA_RECIBIDA;
      }
      return TipoMovimiento.OTRO;
    }
    
    // Si es un cargo (egreso)
    if (descripcionUpper.includes('COMPRA WEB')) {
      return TipoMovimiento.COMPRA_WEB;
    }
    if (descripcionUpper.includes('COMPRA NACIONAL')) {
      return TipoMovimiento.COMPRA_NACIONAL;
    }
    if (descripcionUpper.includes('PAGO AUTOMATICO') || descripcionUpper.includes('PAGO DEUDA')) {
      return TipoMovimiento.PAGO_AUTOMATICO;
    }
    if (descripcionUpper.includes('TEF A') || descripcionUpper.includes('TRANSFERENCIA A')) {
      return TipoMovimiento.TRANSFERENCIA_ENVIADA;
    }
    
    return TipoMovimiento.OTRO;
  }

  private determinarMovementType(descripcion: string, defaultType: 'income' | 'expense'): 'income' | 'expense' {
    if (descripcion.match(/COMPRA|GIRO|PAGO|TEF A|TRANSFERENCIA A/i)) {
      return 'expense';
    } else if (descripcion.match(/TEF DE|TRANSFERENCIA DE|DEPOSITO|ABONO/i)) {
      return 'income';
    }
    return defaultType;
  }

  private determinarCategoria(descripcion: string): string {
    const descripcionUpper = descripcion.toUpperCase();
    
    // Primero, limpiar la descripción de términos genéricos
    const descripcionLimpia = descripcionUpper
      .replace(/TEF A|TEF DE|TRANSFERENCIA A|TRANSFERENCIA DE|COMPRA WEB|COMPRA NACIONAL/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    console.log(`🔍 Analizando descripción: "${descripcion}" -> "${descripcionLimpia}"`);

    // Buscar coincidencias en el archivo companies.json
    for (const company of companies) {
      for (const keyword of company.keywords) {
        if (descripcionLimpia.includes(keyword)) {
          console.log(`✅ Coincidencia encontrada: "${keyword}" -> ${company.normalizedName} (${company.category})`);
          return company.category;
        }
      }
    }

    // Categorización por patrones generales si no se encuentra empresa específica
    if (descripcionLimpia.includes('PAGO AUTOMATICO QR') || descripcionLimpia.includes('PASAJE QR') || descripcionLimpia.includes('PAGO DEUDA')) {
      return 'Transporte';
    }
    
    if (descripcionLimpia.includes('SUPERMERCADO') || descripcionLimpia.includes('MARKET') || 
        descripcionLimpia.includes('TIENDA') || descripcionLimpia.includes('FARMACIA')) {
      return 'Compras';
    }
    
    if (descripcionLimpia.includes('GASOLINA') || descripcionLimpia.includes('COMBUSTIBLE') || 
        descripcionLimpia.includes('COPEC') || descripcionLimpia.includes('SHELL')) {
      return 'Transporte';
    }
    
    if (descripcionLimpia.includes('RESTAURANT') || descripcionLimpia.includes('CAFE') || 
        descripcionLimpia.includes('PIZZA') || descripcionLimpia.includes('COMIDA')) {
      return 'Alimentacion';
    }

    console.log(`❌ No se encontró categoría específica para: "${descripcionLimpia}"`);
    
    // Si no se encuentra ninguna coincidencia, retornar 'Otros'
    return 'Otros';
  }
  async guardarMovimientos(cardId: number, movimientos: IMovimiento[], userId: number, planId: number, saldoFinal: number): Promise<void> {
    try {
      // Verificar límites y permisos
      await this.checkCartolaLimits(userId, planId);
      await this.checkCartolaPermission(planId);

      // Actualizar el saldo de la tarjeta con los nuevos campos
      const updateCardQuery = `
        UPDATE cards 
        SET balance = $1, 
            balance_source = 'cartola',
            last_balance_update = NOW(),
            updated_at = NOW() 
        WHERE id = $2 AND user_id = $3
        RETURNING *
      `;
      await this.pool.query(updateCardQuery, [saldoFinal, cardId, userId]);

      // Procesar cada movimiento
      for (const movimiento of movimientos) {
        const movementType = this.determinarMovementType(
          movimiento.descripcion,
          movimiento.cargos !== null ? 'expense' : 'income'
        );

        const amount = movimiento.cargos || movimiento.abonos || 0;

        // Determinar categoría automáticamente
        const categoryName = this.determinarCategoria(movimiento.descripcion);
        console.log(`🏷️  Categoría determinada para "${movimiento.descripcion}": ${categoryName}`);

        // Buscar el ID de la categoría en la base de datos (las categorías del sistema no tienen user_id)
        let categoryId = null;
        try {
          const categoryQuery = `
            SELECT id FROM categories 
            WHERE name_category = $1 AND is_system = true
            LIMIT 1
          `;
          const categoryResult = await this.pool.query(categoryQuery, [categoryName]);
          
          if (categoryResult.rows.length > 0) {
            categoryId = categoryResult.rows[0].id;
          } else {
            // Si no existe la categoría del sistema, usar la categoría "Otros"
            const otherCategoryQuery = `
              SELECT id FROM categories 
              WHERE name_category = 'Otros' AND is_system = true
              LIMIT 1
            `;
            const otherCategoryResult = await this.pool.query(otherCategoryQuery);
            if (otherCategoryResult.rows.length > 0) {
              categoryId = otherCategoryResult.rows[0].id;
            }
            console.log(`⚠️  Categoría "${categoryName}" no encontrada, usando 'Otros' con ID: ${categoryId}`);
          }
        } catch (categoryError) {
          console.error('Error al buscar categoría:', categoryError);
          // Si hay error, continuar sin categoría
        }

        const movementData = {
          cardId,
          amount,
          description: movimiento.descripcion,
          movementType,
          movementSource: 'cartola',
          transactionDate: movimiento.fecha,
          categoryId
        };

        // Crear el movimiento con categoría automática
        const query = `
          INSERT INTO movements (
            card_id, amount, description, 
            movement_type, movement_source, transaction_date,
            category_id, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        `;
        
        await this.pool.query(query, [
          movementData.cardId,
          movementData.amount,
          movementData.description,
          movementData.movementType,
          movementData.movementSource,
          movementData.transactionDate,
          movementData.categoryId
        ]);
      }
    } catch (error) {
      console.error('Error al guardar movimientos:', error);
      throw error;
    }
  }
  public detectCardTypeFromTitle(title: string): number {
    const tipoMap = {
      'CUENTARUT': 9,    // ID para CuentaRUT
      'CUENTAVISTA': 2,  // ID para Cuenta Vista
      'CREDITO': 3,      // ID para Tarjeta de Crédito
      'AHORRO': 4        // ID para Cuenta Ahorro
    };

    const titleUpper = title.toUpperCase().replace(/\s+/g, '');
    
    for (const [tipo, id] of Object.entries(tipoMap)) {
      if (titleUpper.includes(tipo)) {
        return id;
      }
    }

    return 1; // ID por defecto para Otro tipo de cuenta
  }
} 
