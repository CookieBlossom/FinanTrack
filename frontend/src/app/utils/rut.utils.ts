/**
 * Utilidades para el manejo y validación de RUT chileno
 */
export class RutUtils {
  /**
   * Limpia un RUT de cualquier formato, dejando solo números y dígito verificador
   */
  static clean(rut: string): string {
    return rut.toString().replace(/[^0-9kK]/g, '').toUpperCase();
  }

  /**
   * Formatea un RUT al formato estándar (XX.XXX.XXX-X)
   */
  static format(rut: string): string {
    const cleaned = this.clean(rut);
    if (cleaned.length <= 1) return cleaned;

    let result = cleaned.slice(-4, -1) + '-' + cleaned.slice(-1);
    for (let i = 4; i < cleaned.length; i += 3) {
      result = cleaned.slice(-3 - i, -i) + '.' + result;
    }
    return result;
  }

  /**
   * Calcula el dígito verificador para un RUT
   */
  private static calculateDv(rut: number): string {
    let sum = 0;
    let factor = 2;

    // Convertir el número a string y recorrerlo de derecha a izquierda
    for (const digit of rut.toString().split('').reverse()) {
      sum += parseInt(digit) * factor;
      factor = factor === 7 ? 2 : factor + 1;
    }

    const dv = 11 - (sum % 11);
    if (dv === 11) return '0';
    if (dv === 10) return 'K';
    return dv.toString();
  }

  /**
   * Valida si un RUT es válido
   */
  static validate(rut: string): boolean {
    if (!rut) return false;

    const cleaned = this.clean(rut);
    if (cleaned.length < 2) return false;

    // Separar número base y dígito verificador
    const body = parseInt(cleaned.slice(0, -1));
    const dv = cleaned.slice(-1).toUpperCase();

    // Validar que el cuerpo sea un número
    if (isNaN(body)) return false;

    // Calcular y comparar dígito verificador
    return this.calculateDv(body) === dv;
  }

  /**
   * Formatea un RUT para mostrar al usuario (con puntos y guión)
   * @param rut RUT sin formato o con cualquier formato
   * @returns RUT formateado (ej: 12.345.678-9)
   */
  static formatDisplay(rut: string): string {
    if (!rut) return '';
    
    // Limpiar formato
    let value = rut.replace(/\./g, '').replace(/-/g, '').trim();
    
    // Obtener DV
    const dv = value.slice(-1);
    // Obtener cuerpo
    let rutBody = value.slice(0, -1);
    
    // Agregar puntos
    rutBody = rutBody.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    
    return `${rutBody}-${dv}`;
  }

  /**
   * Formatea un RUT para mostrar con separador de miles personalizado
   * @param rut RUT sin formato
   * @param thousandsSeparator Separador de miles (por defecto punto)
   * @param dvSeparator Separador del dígito verificador (por defecto guión)
   * @returns RUT formateado
   */
  static formatCustom(rut: string, thousandsSeparator: string = '.', dvSeparator: string = '-'): string {
    if (!rut) return '';
    
    const clean = this.clean(rut);
    if (clean.length < 2) return clean;
    
    const dv = clean.slice(-1);
    let rutBody = clean.slice(0, -1);
    
    rutBody = rutBody.replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSeparator);
    
    return `${rutBody}${dvSeparator}${dv}`;
  }
} 