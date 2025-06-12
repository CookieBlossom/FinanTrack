import asyncio
import json
import os
import sys
from datetime import datetime

# Agregar el directorio raíz del scraper al path de Python
scraper_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.append(scraper_root)

from sites.banco_estado import BancoEstadoScraper, ScraperConfig, Credentials
from playwright.async_api import async_playwright

async def test_scraper():
    # Configuración del scraper
    config = ScraperConfig(
        redis_host='localhost',
        redis_port=6379,
        debug_mode=True,
        geolocation={
            "latitude": -33.4489,
            "longitude": -70.6693
        }
    )
    
    # Crear instancia del scraper
    scraper = BancoEstadoScraper(config)
    
    # Credenciales de prueba
    credentials = Credentials(
        rut="21.737.273-9",  # Reemplazar con un RUT válido
        password="coom004"  # Reemplazar con la contraseña real
    )
    
    try:
        async with async_playwright() as p:
            # Configurar el navegador con más opciones anti-detección
            browser = await p.chromium.launch(
                headless=False,  # Mostrar el navegador
                slow_mo=150  # Hacer las acciones más lentas
            )
            
            # Configurar el contexto con más opciones anti-detección
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                locale="es-CL",
                permissions=["geolocation"],
                geolocation=config.geolocation,
                timezone_id="America/Santiago",
                viewport={"width": 1920, "height": 1080},
                device_scale_factor=1,
                has_touch=False,
                is_mobile=False,
                color_scheme="light"
            )
            
            # Ocultar webdriver
            await context.add_init_script("""
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined
                });
            """)
            
            # Configurar cookies básicas
            await context.add_cookies([
                {
                    'name': 'cookie_consent',
                    'value': 'accepted',
                    'domain': '.bancoestado.cl',
                    'path': '/'
                }
            ])
            
            page = await context.new_page()
            
            # 1. Probar login
            print("🔐 Probando login...")
            await scraper.login_banco_estado(page, credentials)
            print("✅ Login exitoso")
            
            # 2. Probar extracción de saldos
            print("\n💰 Probando extracción de saldos...")
            await scraper.mostrar_saldos(page)
            await page.wait_for_timeout(1000)
            cuentas = await scraper.extract_cuentas(page)
            print(f"✅ Se encontraron {len(cuentas)} cuentas:")
            for cuenta in cuentas:
                print(f"  - {cuenta['nombre']}: {cuenta['saldo']}")
            
            # 3. Probar extracción de movimientos recientes
            print("\n📊 Probando extracción de movimientos recientes...")
            movimientos = await scraper.extract_ultimos_movimientos(page)
            print(f"✅ Se encontraron {len(movimientos)} movimientos recientes")
            
            # 4. Probar extracción de movimientos por cuenta
            print("\n📝 Probando extracción de movimientos por cuenta...")
            for cuenta in cuentas:
                print(f"\nProcesando cuenta: {cuenta['nombre']}")
                movimientos_cuenta = await scraper.extract_movimientos_cuenta(page, cuenta)
                if movimientos_cuenta:
                    print(f"✅ Se encontraron {len(movimientos_cuenta)} movimientos")
                else:
                    print("❌ No se encontraron movimientos")
            
            # Guardar resultados
            result = {
                "success": True,
                "cuentas": cuentas,
                "ultimos_movimientos": movimientos,
                "fecha_extraccion": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
            
            # Guardar en archivo JSON
            results_file = os.path.join(scraper_root, 'test_results.json')
            with open(results_file, 'w', encoding='utf-8') as f:
                json.dump(result, f, ensure_ascii=False, indent=2)
            print(f"\n💾 Resultados guardados en {results_file}")
            
            # Esperar un poco antes de cerrar
            await page.wait_for_timeout(2000)
            await browser.close()
            
    except Exception as e:
        print(f"❌ Error durante la prueba: {str(e)}")
        raise

if __name__ == "__main__":
    asyncio.run(test_scraper()) 