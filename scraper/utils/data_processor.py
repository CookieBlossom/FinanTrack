from datetime import datetime
from typing import Dict, List, Optional, Union, Any
import re
from scraper.models.scraper_models import ScraperAccount, ScraperMovement, ScraperResult

class DataProcessor:
    @staticmethod
    def process_date(date_str: Optional[str]) -> str:
        """Procesa y valida una fecha."""
        if not date_str:
            return datetime.now().isoformat()

        try:
            # Si la fecha viene en formato DD/MM/YYYY
            if '/' in date_str:
                day, month, year = map(int, date_str.split('/'))
                return datetime(year, month, day).isoformat()
            
            # Si la fecha ya viene en formato ISO
            return datetime.fromisoformat(date_str).isoformat()
        except (ValueError, TypeError):
            return datetime.now().isoformat()

    @staticmethod
    def process_amount(amount: Union[str, int, float]) -> float:
        """Procesa y valida un monto."""
        if isinstance(amount, (int, float)):
            return float(amount)
        
        if not isinstance(amount, str):
            return 0.0

        try:
            # Remover caracteres no numéricos excepto - y .
            amount = re.sub(r'[^\d\-\.]', '', amount)
            return float(amount)
        except (ValueError, TypeError):
            return 0.0

    @staticmethod
    def process_description(description: Optional[str]) -> str:
        """Procesa y valida una descripción."""
        if not description:
            return ''
        
        # Remover caracteres especiales y espacios múltiples
        description = re.sub(r'\s+', ' ', str(description).strip())
        return description

    @staticmethod
    def process_movement(raw_movement: Union[Dict[str, Any], ScraperMovement]) -> Dict[str, Any]:
        """Procesa y valida un movimiento."""
        try:
            if isinstance(raw_movement, ScraperMovement):
                fecha = DataProcessor.process_date(raw_movement.fecha)
                monto = DataProcessor.process_amount(raw_movement.monto)
                descripcion = DataProcessor.process_description(raw_movement.descripcion)
                return {
                    'fecha': fecha,
                    'descripcion': descripcion,
                    'monto': monto,
                    'tipo': raw_movement.tipo.strip(),
                    'cuenta': raw_movement.cuenta.strip(),
                    'estado': raw_movement.estado
                }
            else:
                fecha = DataProcessor.process_date(raw_movement.get('fecha'))
                monto = DataProcessor.process_amount(raw_movement.get('monto', 0))
                descripcion = DataProcessor.process_description(raw_movement.get('descripcion'))
                return {
                    'fecha': fecha,
                    'descripcion': descripcion,
                    'monto': monto,
                    'tipo': raw_movement.get('tipo', '').strip(),
                    'cuenta': raw_movement.get('cuenta', '').strip(),
                    'estado': 'procesado'
                }
        except Exception as e:
            print(f'Error al procesar movimiento: {e}')
            return None

    @staticmethod
    def process_account(raw_account: Union[Dict[str, Any], ScraperAccount]) -> Dict[str, Any]:
        """Procesa y valida una cuenta."""
        try:
            if isinstance(raw_account, ScraperAccount):
                saldo = DataProcessor.process_amount(raw_account.saldo)
                return {
                    'numero': raw_account.numero,
                    'tipo': raw_account.tipo,
                    'saldo': saldo,
                    'moneda': raw_account.moneda,
                    'titular': raw_account.titular,
                    'estado': 'activa'
                }
            else:
                saldo = DataProcessor.process_amount(raw_account.get('saldo', 0))
                nombre = raw_account.get('nombre') or raw_account.get('tipo') or raw_account.get('numero', 'Cuenta sin nombre')
                return {
                    'numero': raw_account.get('numero', ''),
                    'tipo': nombre,
                    'saldo': saldo,
                    'moneda': raw_account.get('moneda', 'CLP'),
                    'titular': raw_account.get('titular', ''),
                    'estado': 'activa'
                }
        except Exception as e:
            print(f'Error al procesar cuenta: {e}')
            return None

    @staticmethod
    def process_scraper_result(raw_result: Union[Dict[str, Any], ScraperResult]) -> Dict[str, Any]:
        """Procesa y valida el resultado completo del scraper."""
        try:
            # Si es un ScraperResult, convertirlo a diccionario
            if isinstance(raw_result, ScraperResult):
                raw_result = {
                    'success': raw_result.success,
                    'fecha_extraccion': raw_result.fecha_extraccion,
                    'message': raw_result.message,
                    'cuentas': [vars(cuenta) for cuenta in raw_result.cuentas],
                    'ultimos_movimientos': [vars(mov) for mov in raw_result.ultimos_movimientos],
                    'metadata': raw_result.metadata
                }

            if not isinstance(raw_result, dict):
                raise ValueError('Resultado del scraper inválido')

            if not isinstance(raw_result.get('success'), bool):
                raise ValueError('Campo success requerido y debe ser booleano')

            fecha_extraccion = DataProcessor.process_date(raw_result.get('fecha_extraccion'))

            # Procesar cuentas
            cuentas = []
            if isinstance(raw_result.get('cuentas'), list):
                for cuenta in raw_result['cuentas']:
                    cuenta_procesada = DataProcessor.process_account(cuenta)
                    if cuenta_procesada:
                        cuentas.append(cuenta_procesada)

            # Procesar movimientos
            movimientos = []
            if isinstance(raw_result.get('ultimos_movimientos'), list):
                for mov in raw_result['ultimos_movimientos']:
                    mov_procesado = DataProcessor.process_movement(mov)
                    if mov_procesado:
                        movimientos.append(mov_procesado)

            return {
                'success': raw_result['success'],
                'fecha_extraccion': fecha_extraccion,
                'message': DataProcessor.process_description(raw_result.get('message')),
                'cuentas': cuentas,
                'ultimos_movimientos': movimientos,
                'metadata': {
                    'banco': raw_result.get('metadata', {}).get('banco', 'banco_estado'),
                    'tipo_consulta': raw_result.get('metadata', {}).get('tipo_consulta', 'movimientos_recientes'),
                    'fecha_inicio': raw_result.get('metadata', {}).get('fecha_inicio'),
                    'fecha_fin': raw_result.get('metadata', {}).get('fecha_fin'),
                    **raw_result.get('metadata', {})
                }
            }
        except Exception as e:
            print(f'Error al procesar resultado del scraper: {e}')
            raise 