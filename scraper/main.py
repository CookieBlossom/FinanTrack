#main.py
import asyncio
import argparse
import importlib
import os
import sys
from dotenv import load_dotenv

load_dotenv()
# Función para listar los scrapers disponibles
def list_available_scrapers():
    scrapers = []
    sites_dir = os.path.join(os.path.dirname(__file__), 'sites', 'banco_estado')
    if os.path.exists(sites_dir):
        for file in os.listdir(sites_dir):
            if file.endswith(".py") and not file.startswith("__"):
                scraper_name = file[:-3]  # Quitar la extensión .py
                scrapers.append(scraper_name)
    return scrapers

async def main():
    parser = argparse.ArgumentParser(description='Ejecuta scrapers específicos de BancoEstado')
    parser.add_argument('--list', action='store_true', help='Listar los scrapers disponibles')
    parser.add_argument('--scraper', type=str, help='Nombre del scraper a ejecutar (ej: banco_estado_saldos)')
    parser.add_argument('--redis-host', type=str, default=os.environ.get('REDIS_HOST', 'localhost'), help='Host de Redis')
    parser.add_argument('--redis-password', type=str, default=os.environ.get('REDIS_PASSWORD'), help='Contraseña de Redis')
    parser.add_argument('--redis-port', type=int, default=int(os.environ.get('REDIS_PORT', 6379)), help='Puerto de Redis')
    parser.add_argument('--results-dir', type=str, default='results', help='Directorio para guardar resultados')
    
    args = parser.parse_args()
    
    # Listar scrapers disponibles si se solicita
    if args.list:
        print("Scrapers disponibles:")
        for scraper in list_available_scrapers():
            print(f"  - {scraper}")
        return
    
    # Si no se especifica un scraper, usar el completo por defecto
    scraper_name = args.scraper or "banco_estado"
    
    try:
        # Intentar importar el módulo del scraper
        module_path = f"sites.banco_estado.{scraper_name}"
        print(f"Intentando importar: {module_path}")
        
        try:
            scraper_module = importlib.import_module(module_path)
        except ImportError as e:
            print(f"Error al importar el scraper {scraper_name}: {e}")
            print("Asegúrate de que el nombre del scraper es correcto y existe en la carpeta sites/banco_estado/")
            return
        
        # Buscar la clase ScraperConfig
        if hasattr(scraper_module, 'ScraperConfig'):
            config_class = getattr(scraper_module, 'ScraperConfig')
            config = config_class(
                redis_host=args.redis_host,
                redis_port=args.redis_port,
                results_dir=args.results_dir
            )
        else:
            print(f"Error: No se encontró la clase ScraperConfig en el módulo {scraper_name}")
            return
        
        # Buscar la clase del scraper (normalmente tendrá 'Scraper' en el nombre)
        scraper_class = None
        for attr_name in dir(scraper_module):
            if 'Scraper' in attr_name and attr_name != 'ScraperConfig':
                scraper_class = getattr(scraper_module, attr_name)
                break
        
        if scraper_class:
            print(f"Ejecutando {scraper_class.__name__}...")
            scraper = scraper_class(config)
            await scraper.run()
        else:
            print(f"Error: No se encontró una clase Scraper en el módulo {scraper_name}")
            return
    
    except Exception as e:
        print(f"Error al ejecutar el scraper: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())