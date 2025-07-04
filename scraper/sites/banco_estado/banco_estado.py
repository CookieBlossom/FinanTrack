import json
import random
import redis
import os
import re
from datetime import datetime
from playwright.async_api import async_playwright
from dataclasses import dataclass
from typing import Optional, Dict, Any, List
import asyncio
import sys

# Agregar el directorio raíz del proyecto al path de Python
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
if project_root not in sys.path:
    sys.path.append(project_root)

from scraper.utils.redis_client import get_task, store_result, update_task_status
from scraper.utils.config import ScraperConfig
from scraper.models.scraper_models import ScraperTask, ScraperResult, ScraperAccount, ScraperMovement

@dataclass
class Credentials:
    rut: str
    password: str

class BancoEstadoScraper:
    def __init__(self, config: ScraperConfig):
        self.config = config
        # Inicializar Redis con la configuración proporcionada
        self.redis_client = redis.Redis(
            host=self.config.redis_host, 
            port=self.config.redis_port, 
            decode_responses=True
        )

    async def ocultar_ventana(self):
        """
        Por ahora este método está vacío ya que no podemos ocultar la ventana
        debido a limitaciones de la librería. Se mantiene para compatibilidad futura.
        """
        pass

    async def run(self, task_id: str, task_data: dict) -> Optional[Dict[str, Any]]:
        """Ejecuta el scraper"""
        try:
            # Verificar que Redis esté conectado
            if not self.redis_client.ping():
                raise Exception("No se pudo conectar a Redis")

            # Extraer credenciales
            rut = task_data.get('data', {}).get('rut')
            password = task_data.get('data', {}).get('password')

            if not rut or not password:
                print("ERROR: Credenciales incompletas")
                update_task_status(self.redis_client, task_id, 'failed', 'Credenciales incompletas')
                return None

            print("[Scraper BancoEstado iniciado]")
            async with async_playwright() as p:
                # Iniciar navegador con configuración mejorada
                update_task_status(self.redis_client, task_id, 'processing', 'Iniciando navegador', 10)
                # Configurar directorio para datos persistentes
                user_data_dir = os.path.join(os.path.dirname(__file__), 'user_data')
                os.makedirs(user_data_dir, exist_ok=True)
                # Generar un user agent aleatorio basado en versiones recientes de Chrome
                chrome_version = random.randint(110, 122)
                build_version = random.randint(0, 9999)
                user_agent = f'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{chrome_version}.0.{build_version}.0 Safari/537.36'
                
                # Configurar el contexto persistente con todas las opciones
                context = await p.chromium.launch_persistent_context(
                    user_data_dir,
                    headless=False,
                    user_agent=user_agent,
                    viewport={'width': 1920, 'height': 1080},
                    locale='es-CL',
                    timezone_id='America/Santiago',
                    permissions=['geolocation'],
                    accept_downloads=True,
                    args=[
                        "--disable-blink-features=AutomationControlled",
                        "--start-maximized",
                        "--no-sandbox",
                        "--disable-dev-shm-usage",
                        "--disable-extensions",
                        "--disable-infobars",
                        "--window-position=0,0",
                        "--ignore-certificate-errors",
                        "--no-first-run",
                        "--no-service-autorun",
                        "--password-store=basic",
                        "--disable-web-security",
                        "--disable-features=IsolateOrigins,site-per-process",
                        "--disable-site-isolation-trials",
                        "--disable-features=BlockInsecurePrivateNetworkRequests",
                        f"--user-agent={user_agent}"
                    ]
                )

                # Script de evasión mejorado
                await context.add_init_script("""
                    // Función para definir propiedades de manera segura
                    const safeDefineProperty = (obj, prop, value) => {
                        try {
                            Object.defineProperty(obj, prop, {
                                value: value,
                                writable: false,
                                configurable: false,
                                enumerable: true
                            });
                        } catch (e) {}
                    };

                    // Ocultar webdriver completamente
                    delete Object.getPrototypeOf(navigator).webdriver;
                    
                    // Simular Chrome real
                    const originalChrome = window.chrome || {};
                    safeDefineProperty(window, 'chrome', {
                        ...originalChrome,
                        app: {
                            InstallState: {
                                DISABLED: 'DISABLED',
                                INSTALLED: 'INSTALLED',
                                NOT_INSTALLED: 'NOT_INSTALLED'
                            },
                            RunningState: {
                                CANNOT_RUN: 'CANNOT_RUN',
                                READY_TO_RUN: 'READY_TO_RUN',
                                RUNNING: 'RUNNING'
                            },
                            getDetails: function() {},
                            getIsInstalled: function() {},
                            installState: function() { return 'NOT_INSTALLED'; },
                            isInstalled: false,
                            runningState: function() { return 'CANNOT_RUN'; }
                        },
                        runtime: originalChrome.runtime || {}
                    });
                    
                    // Simular plugins realistas
                    const plugins = [
                        {
                            name: 'Chrome PDF Viewer',
                            filename: 'internal-pdf-viewer',
                            description: 'Portable Document Format',
                            length: 1,
                            item: function(index) { return this[0]; },
                            namedItem: function(name) { return this[0]; },
                            refresh: function() {},
                            [0]: {
                                type: 'application/pdf',
                                suffixes: 'pdf',
                                description: 'Portable Document Format'
                            }
                        }
                    ];
                    
                    plugins.__proto__ = Array.prototype;
                    plugins.item = function(index) { return this[index]; };
                    plugins.namedItem = function(name) { return this[0]; };
                    plugins.refresh = function() {};
                    
                    safeDefineProperty(navigator, 'plugins', plugins);
                    safeDefineProperty(navigator, 'languages', ['es-CL', 'es', 'en-US', 'en']);
                    safeDefineProperty(navigator, 'platform', 'Win32');
                    
                    // Simular conexión
                    safeDefineProperty(navigator, 'connection', {
                        downlink: 10,
                        effectiveType: "4g",
                        rtt: 50,
                        saveData: false
                    });
                    
                    // Simular hardware
                    safeDefineProperty(navigator, 'deviceMemory', 8);
                    safeDefineProperty(navigator, 'hardwareConcurrency', 8);
                    
                    // Simular permisos
                    const originalQuery = window.navigator.permissions.query;
                    window.navigator.permissions.query = (parameters) => (
                        parameters.name === 'notifications' 
                            ? Promise.resolve({state: Notification.permission})
                            : originalQuery(parameters)
                    );
                    
                    // Ocultar automation completamente
                    delete window.domAutomation;
                    delete window.domAutomationController;
                    delete window._WEBDRIVER_ELEM_CACHE;
                    delete window.webdriver;
                    delete window.navigator.webdriver;
                    
                    // Simular funciones de debugging
                    window.console.debug = () => {};
                    
                    // Simular performance realista
                    if (!window.performance) {
                        window.performance = {
                            memory: {
                                jsHeapSizeLimit: 2172649472,
                                totalJSHeapSize: 2172649472,
                                usedJSHeapSize: 2172649472
                            },
                            navigation: {
                                redirectCount: 0,
                                type: 0
                            },
                            timing: {
                                navigationStart: Date.now(),
                                loadEventEnd: Date.now() + 1000
                            }
                        };
                    }
                """)
                
                page = await context.new_page()
                
                # Configurar interceptor para headers más realistas
                await page.route("**/*", lambda route: route.continue_(
                    headers={
                        **route.request.headers,
                        "sec-ch-ua": '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
                        "sec-ch-ua-mobile": "?0",
                        "sec-ch-ua-platform": '"Windows"',
                        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                        "Accept-Language": "es-CL,es;q=0.9,en-US;q=0.8,en;q=0.7",
                        "Accept-Encoding": "gzip, deflate, br",
                        "Sec-Fetch-Dest": "document",
                        "Sec-Fetch-Mode": "navigate",
                        "Sec-Fetch-Site": "none",
                        "Sec-Fetch-User": "?1",
                        "Upgrade-Insecure-Requests": "1",
                        "Cache-Control": "no-cache",
                        "Pragma": "no-cache"
                    }
                ))

                try:
                    # Login con tiempos mejorados
                    update_task_status(self.redis_client, task_id, 'processing', 'Iniciando sesión', 20)
                    await self.login_banco_estado(page, {'rut': rut, 'password': password})
                    await page.wait_for_timeout(random.randint(400, 1200))  # Espera adicional después del login

                    # Obtener saldos
                    update_task_status(self.redis_client, task_id, 'processing', 'Obteniendo saldos', 40)
                    cuentas = await self.extract_cuentas(page)
                    await page.wait_for_timeout(random.randint(400, 1200))

                    # Obtener movimientos generales
                    update_task_status(self.redis_client, task_id, 'processing', 'Obteniendo movimientos generales', 60)
                    movimientos_generales = await self.extract_ultimos_movimientos(page)
                    await page.wait_for_timeout(random.randint(400, 1200))

                    # Obtener movimientos por cuenta y actualizar las cuentas
                    update_task_status(self.redis_client, task_id, 'processing', 'Obteniendo movimientos por cuenta', 70)
                    for i, cuenta in enumerate(cuentas):
                        movs_cuenta = await self.extract_movimientos_cuenta(page, cuenta)
                        cuentas[i] = {
                            **cuenta,
                            'movimientos': movs_cuenta
                        }
                        await page.wait_for_timeout(random.randint(400, 1200))

                    # Procesar resultados
                    update_task_status(self.redis_client, task_id, 'processing', 'Procesando resultados', 80)

                    # Crear el resultado
                    result = {
                        'success': True,
                        'fecha_extraccion': datetime.now().isoformat(),
                        'message': 'Scraping completado exitosamente',
                        'cuentas': cuentas,
                        'ultimos_movimientos': movimientos_generales,
                        'metadata': {
                            'banco': 'banco_estado',
                            'tipo_consulta': 'movimientos_recientes'
                        }
                    }

                    # Guardar resultados
                    store_result(self.redis_client, task_id, result)
                    print(f"Scraping completado para RUT: {rut}")

                    return result

                except Exception as e:
                    print(f"ERROR durante el scraping: {str(e)}")
                    update_task_status(self.redis_client, task_id, 'failed', str(e))
                    raise

        except Exception as e:
            print(f"ERROR durante el scraping: {str(e)}")
            update_task_status(self.redis_client, task_id, 'failed', str(e))
            return None

    async def stop(self):
        """Detiene el bucle de procesamiento de tareas"""
        self._running = False

    async def espera_aleatoria(self, page):
        """Espera aleatoria más realista"""
        base_time = random.randint(200, 600)  # Más lento para ser más realista
        jitter = random.randint(-50, 50)
        await page.wait_for_timeout(base_time + jitter)

    async def cerrar_modal_infobar(self, page):
        """Cierra modales de infobar"""
        try:
            await page.evaluate("""
                const closeButtons = Array.from(document.querySelectorAll('button[aria-label*="Close"]'));
                for (const button of closeButtons) {
                    if (button.offsetParent !== null) {
                        button.click();
                    }
                }
            """)
            await page.wait_for_timeout(600)  # Aumentado de 300ms a 600ms
            
            modal_btn = page.locator("button.evg-btn-dismissal[aria-label*='Close']")
            if await modal_btn.count() > 0:
                try:
                    await modal_btn.scroll_into_view_if_needed()
                    await page.wait_for_timeout(600)  # Aumentado de 300ms a 600ms
                    await modal_btn.click(timeout=5000)
                    print("Modal de infobar cerrado")
                except Exception:
                    print("No se pudo cerrar el modal de infobar")
            else:
                print("No apareció el modal de infobar")
        except Exception as e:
            print(f"Info al intentar cerrar el modal: {e}")

    async def cerrar_sidebar(self, page):
        try:
            # Lista de posibles IDs de sidebars
            sidebar_ids = ["holidayid", "afpid", "promoid", "infoid"]
            # Intentar cerrar sidebars por ID
            for sidebar_id in sidebar_ids:
                try:
                    sidebar = page.locator(f"#{sidebar_id} button[aria-label='Cerrar']")
                    if await sidebar.count() > 0 and await sidebar.is_visible():
                        await sidebar.click()
                        print(f"Sidebar {sidebar_id} cerrado")
                        await page.wait_for_timeout(1000)
                        return True
                except Exception:
                    continue
            # Intentar cerrar sidebars por clase común
            try:
                sidebar_class = page.locator(".sidebar-container button[aria-label='Cerrar'], .modal-container button[aria-label='Cerrar']")
                if await sidebar_class.count() > 0 and await sidebar_class.is_visible():
                    await sidebar_class.click()
                    print("Sidebar genérico cerrado")
                    await page.wait_for_timeout(1000)
                    return True
            except Exception:
                pass
            # Intentar cerrar cualquier botón de cierre visible
            try:
                close_buttons = page.locator("button[aria-label='Cerrar']").all()
                for button in await close_buttons:
                    try:
                        if await button.is_visible():
                            # Verificar que el botón está dentro de un sidebar o modal
                            parent = await button.evaluate("""
                                (button) => {
                                    const container = button.closest('.sidebar-container, .modal-container, [role="dialog"]');
                                    return container ? true : false;
                                }
                            """)
                            if parent:
                                await button.click()
                                print("Sidebar/modal cerrado")
                                await page.wait_for_timeout(1000)
                                return True
                    except Exception:
                        continue
            except Exception:
                pass
            print("No hay sidebars para cerrar")
            return False
        except Exception as e:
            print(f"Info: {str(e)}")
            return False

    async def type_like_human(self, page, selector, text, delay=None):
        """Simula escritura humana más realista"""
        try:
            element = await page.wait_for_selector(selector, state="visible")
            await element.click()
            await page.wait_for_timeout(random.randint(300, 700))  # Aumentado de 100-200ms a 300-700ms
            
            await element.fill("")
            await page.wait_for_timeout(random.randint(350, 400))  # Aumentado de 150-300ms a 350-400ms
            
            if delay is None:
                if "pass" in selector.lower():
                    base_delay = random.randint(200, 550)  # Aumentado para contraseñas
                else:
                    base_delay = random.randint(250, 550)  # Aumentado para otros campos
            else:
                base_delay = delay
            
            for i, char in enumerate(text):
                char_delay = base_delay
                
                if i > 0:
                    prev_char = text[i-1]
                    if prev_char in ['.', ' ', '-']:
                        char_delay *= 1.5
                    elif prev_char.isdigit() != char.isdigit():
                        char_delay *= 1.3
                    elif char == prev_char:
                        char_delay *= 0.8
                
                char_delay *= random.uniform(0.8, 1.3)
                
                # Simular error de escritura ocasional
                if random.random() < 0.005:
                    wrong_char = random.choice('qwertyuiopasdfghjklzxcvbnm')
                    await element.type(wrong_char, delay=char_delay)
                    await page.wait_for_timeout(random.randint(400, 800))
                    await page.keyboard.press('Backspace')
                    await page.wait_for_timeout(random.randint(200, 400))
                
                await element.type(char, delay=char_delay)
                
                if random.random() < 0.015:
                    await page.wait_for_timeout(random.randint(300, 800))
            
            await page.wait_for_timeout(random.randint(400, 1200))  # Aumentado de 200-400ms a 400-1200ms
            
        except Exception as e:
            print(f"ERROR en type_like_human: {e}")
            await page.fill(selector, text)

    async def simular_comportamiento_humano(self, page):
        """Simula comportamiento humano más realista"""
        # Movimientos de mouse más naturales
        for _ in range(random.randint(2, 4)):
            x = random.randint(100, 1200)
            y = random.randint(100, 800)
            await page.mouse.move(x, y, steps=random.randint(3, 6))
            await page.wait_for_timeout(random.randint(100, 300))
        
        # Scroll aleatorio
        await page.evaluate("""
            window.scrollTo({
                top: Math.random() * document.body.scrollHeight * 0.3,
                behavior: 'smooth'
            });
        """)
        await page.wait_for_timeout(random.randint(400, 1200))  # Aumentado de 300-700ms a 400-1200ms

    async def mostrar_saldos(self, page):
        try:
            # Intentar cerrar cualquier sidebar antes de interactuar
            await self.cerrar_sidebar(page)
            print("Intentando mostrar saldos...")
            
            # Comenzar directamente con el método que sabemos que funciona
            print("  Intentando mostrar saldos con botón mostrar/ocultar...")
            try:
                await page.evaluate("""() => {
                    const botones = Array.from(document.querySelectorAll('button, input[type="checkbox"]')).filter(b => {
                        const texto = (b.textContent || '').toLowerCase();
                        const ariaLabel = (b.getAttribute('aria-label') || '').toLowerCase();
                        return texto.includes('mostrar') || texto.includes('ocultar') || 
                               ariaLabel.includes('mostrar') || ariaLabel.includes('ocultar');
                    });
                    botones.forEach(b => {
                        if (b.type === 'checkbox' && b.checked) {
                            b.click();
                        } else if (b.type !== 'checkbox') {
                            b.click();
                        }
                    });
                }""")
                
                # Reducir el tiempo de espera de 1500ms a 800ms
                await page.wait_for_timeout(800)
                
                # Verificar si los saldos son visibles
                if await self.verificar_saldos_visibles(page):
                    print("[OK] Saldos mostrados correctamente")
                    return True
                    
                # Si no funcionó, intentar una vez más con un pequeño delay
                await page.wait_for_timeout(500)
                if await self.verificar_saldos_visibles(page):
                    print("[OK] Saldos mostrados correctamente en segundo intento")
                    return True
                    
                print("[WARNING] No se pudieron mostrar los saldos")
                return False
                
            except Exception as e:
                print(f"ℹ️ Error al mostrar saldos: {e}")
                return False
                
        except Exception as e:
            print(f"ℹ️ Error general al intentar mostrar saldos: {e}")
            return False
            
    async def verificar_saldos_visibles(self, page):
        try:
            # Verificar si hay saldos ocultos (asteriscos)
            saldos_ocultos = await page.evaluate("""
                () => {
                    const elementos = document.querySelectorAll('[class*="saldo"], [class*="monto"]');
                    for (const el of elementos) {
                        if (el.textContent.includes('*')) return true;
                    }
                    return false;
                }
            """)
            
            if saldos_ocultos:
                return False
                
            # Verificar si hay saldos visibles con formato de dinero
            saldos_visibles = await page.evaluate("""
                () => {
                    const saldoRegex = /\\$[\\d.,]+/;
                    const elementos = document.querySelectorAll('[class*="saldo"], [class*="monto"]');
                    for (const el of elementos) {
                        if (saldoRegex.test(el.textContent)) return true;
                    }
                    return false;
                }
            """)
            
            return saldos_visibles
            
        except Exception:
            return False

    async def extraer_info_tarjeta(self, card):
        """
        Extrae información de una tarjeta (cuenta) del nuevo formato de BancoEstado
        """
        try:
            info = {}
            
            # Extraer nombre de la cuenta
            try:
                nombre_obtenido = False
                # Intento 1: Buscar h3 visible que no sea sr_only
                nombre_el_visible_not_sr = card.locator("h3:not(.sr_only):visible")
                if await nombre_el_visible_not_sr.count() > 0:
                    nombre = await nombre_el_visible_not_sr.first.text_content()
                    if nombre:
                        info["nombre"] = nombre.strip()
                        nombre_obtenido = True

                # Intento 2: Si no se encontró, buscar h3 con aria-hidden="true" (suele tener el nombre)
                if not nombre_obtenido:
                    nombre_el_aria_hidden = card.locator("h3[aria-hidden='true']")
                    if await nombre_el_aria_hidden.count() > 0:
                        nombre = await nombre_el_aria_hidden.first.text_content()
                        if nombre:
                            info["nombre"] = nombre.strip()
                            nombre_obtenido = True
                
                # Intento 3: Fallback si los anteriores fallan, tomar el primer h3 que no sea sr_only (incluso si no está visible)
                if not nombre_obtenido:
                    nombre_el_not_sr = card.locator("h3:not(.sr_only)")
                    if await nombre_el_not_sr.count() > 0:
                        nombre = await nombre_el_not_sr.first.text_content()
                        if nombre:
                            info["nombre"] = nombre.strip()
                            nombre_obtenido = True

            except Exception as e:
                print(f"[WARNING] Error al extraer nombre con selectores h3 directos: {e}")
            
            # Si no encontramos el nombre con los h3 directos, intentar desde otros elementos (selector alternativo)
            if "nombre" not in info or not info.get("nombre"):
                try:
                    nombre_obtenido_alt = False
                    # Intento 1 Alt:
                    alt_nombre_el_visible_not_sr = card.locator(".m-card-global__header--title h3:not(.sr_only):visible")
                    if await alt_nombre_el_visible_not_sr.count() > 0:
                        nombre_alt = await alt_nombre_el_visible_not_sr.first.text_content()
                        if nombre_alt:
                            info["nombre"] = nombre_alt.strip()
                            nombre_obtenido_alt = True
                    
                    # Intento 2 Alt:
                    if not nombre_obtenido_alt:
                        alt_nombre_el_aria_hidden = card.locator(".m-card-global__header--title h3[aria-hidden='true']")
                        if await alt_nombre_el_aria_hidden.count() > 0:
                            nombre_alt = await alt_nombre_el_aria_hidden.first.text_content()
                            if nombre_alt:
                                info["nombre"] = nombre_alt.strip()
                                nombre_obtenido_alt = True

                    # Intento 3 Alt:
                    if not nombre_obtenido_alt:
                        alt_nombre_el_not_sr = card.locator(".m-card-global__header--title h3:not(.sr_only)")
                        if await alt_nombre_el_not_sr.count() > 0:
                            nombre_alt = await alt_nombre_el_not_sr.first.text_content()
                            if nombre_alt:
                                info["nombre"] = nombre_alt.strip()
                                
                except Exception as e_alt:
                    print(f"[WARNING] Error al extraer nombre con selector alternativo .m-card-global__header--title h3: {e_alt}")
            
            # Si aún no tenemos nombre, extraerlo del HTML como último recurso
            if "nombre" not in info or not info.get("nombre"):
                try:
                    html = await card.evaluate("el => el.innerHTML")
                    # Buscar patrones como "CuentaRUT" o "AHORRO PREMIUM"
                    nombre_match = re.search(r'>(CuentaRUT|AHORRO PREMIUM|Plazo Vivienda[^<]+)<', html)
                    if nombre_match:
                        info["nombre"] = nombre_match.group(1)
                    else:
                        info["nombre"] = "Cuenta sin nombre"
                except Exception as e:
                    info["nombre"] = "Cuenta sin nombre"
                    print(f"[WARNING] Error al extraer nombre del HTML: {e}")
            
            # Extraer número de cuenta
            try:
                # Buscar el número de cuenta que suele estar en un <p> dentro del título
                numero_el = card.locator(".m-card-global__header--title p")
                if await numero_el.count() > 0:
                    numero = await numero_el.text_content()
                    info["numero"] = numero.strip()
                else:
                    # Intentar otros selectores para el número de cuenta
                    alt_numero_selector = "p[aria-hidden='true'][role='text']"
                    alt_numero = card.locator(alt_numero_selector)
                    if await alt_numero.count() > 0:
                        info["numero"] = (await alt_numero.text_content() or "").strip()
                    else:
                        # Intentar extraer de atributos
                        info["numero"] = await card.evaluate("""
                            el => {
                                // Buscar en atributos aria-label que suelen contener el número
                                const ariaLabels = Array.from(el.querySelectorAll('[aria-label]'));
                                for (const element of ariaLabels) {
                                    const label = element.getAttribute('aria-label');
                                    const match = label && label.match(/\\d{8,}/);
                                    if (match) return match[0];
                                }
                                // Buscar cualquier secuencia que parezca número de cuenta
                                const text = el.textContent;
                                const matchText = text && text.match(/\\d{8,}/);
                                return matchText ? matchText[0] : "";
                            }
                        """)
            except Exception as e:
                info["numero"] = ""
                print(f"[WARNING] Error al extraer número: {e}")
            
            # Extraer saldo
            try:
                # Intento 1: Buscar en el área de saldo/monto
                saldo_selector = [
                    "div.m-card-global__content--cuentas__saldos h4",
                    ".msd-card-ahorro__saldo--amount h4",
                    "h4:has-text('$')"
                ]
                
                for selector in saldo_selector:
                    saldo_el = card.locator(selector)
                    if await saldo_el.count() > 0:
                        saldo = await saldo_el.text_content()
                        if saldo:
                            info["saldo"] = saldo.strip()
                            break
                
                # Si no encontramos el saldo, intentar con JavaScript
                if "saldo" not in info or not info["saldo"]:
                    info["saldo"] = await card.evaluate("""
                        el => {
                            // Buscar cualquier texto que coincida con formato de monto
                            const saldoRegex = /\\$[\\d.,]+/;
                            const textos = Array.from(el.querySelectorAll('*'))
                                .map(node => node.textContent)
                                .filter(Boolean);
                            
                            for (const texto of textos) {
                                if (!texto.includes('*')) {  // Ignorar textos con asteriscos
                                    const match = texto.match(saldoRegex);
                                    if (match) return match[0];
                                }
                            }
                            return "";
                        }
                    """)
            except Exception as e:
                info["saldo"] = ""
                print(f"[WARNING] Error al extraer saldo: {e}")
            
            # Verificar que tengamos información mínima
            if not info["nombre"] or info["nombre"] == "Cuenta sin nombre":
                if not info["numero"] and not info["saldo"]:
                    return None
            
            return info
        except Exception as e:
            print(f"ERROR: Error general al extraer info de tarjeta: {e}")
            return None

    async def extract_cuentas(self, page):
        print("[INFO] Extrayendo cuentas...")
        await self.cerrar_modal_infobar(page)
        
        try:
            await page.wait_for_selector("app-carrusel-productos-wrapper", timeout=30000)
            print("[INFO] Encontramos el carrusel")
        except Exception as e:
            print(f"[WARNING] No se encontró el carrusel: {e}")
            # Intentar un selector alternativo más genérico
            try:
                await page.wait_for_selector("div[role='list'], div.carousel, div.slider", timeout=15000)
                print("[INFO] Encontramos un carrusel alternativo")
            except Exception as e2:
                print(f"[WARNING] No se encontró ningún carrusel: {e2}")
                
        await self.cerrar_sidebar(page)

        await self.mostrar_saldos(page)

        tarjetas_encontradas = False
        selectores_tarjetas = [
            "app-card-producto:visible, app-card-ahorro:visible",
            "div[class*='card']:visible",
            "div.carousel-item:visible",
            "div.card:visible",
            "div[role='listitem']:visible"
        ]
        
        for selector in selectores_tarjetas:
            try:
                await page.wait_for_selector(selector, timeout=15000)
                print(f"[OK] Tarjetas encontradas con selector: {selector}")
                tarjetas_encontradas = True
                break
            except Exception:
                print(f"[WARNING] No se encontraron tarjetas con selector: {selector}")
                continue
        
        if not tarjetas_encontradas:
            print("[WARNING] No se encontraron tarjetas con ningún selector")
        
        cuentas = []
        total_cuentas = 0
        # Procesar todas las tarjetas visibles
        for selector in selectores_tarjetas:
            # Obtener tarjetas visibles con el selector actual
            try:
                cards = await page.locator(selector).all()
                if not cards:
                    continue
                
                # Extraer información de cada tarjeta visible
                for card in cards:
                    cuenta_info = await self.extraer_info_tarjeta(card)
                    if cuenta_info:
                        # Convertir el diccionario al formato esperado por ScraperAccount
                        cuenta_formateada = {
                            "numero": cuenta_info.get("numero", ""),
                            "tipo": cuenta_info.get("nombre", ""),  # Usamos el nombre como tipo
                            "saldo": self.convertir_saldo_a_float(cuenta_info.get("saldo", "0")),
                            "moneda": "CLP",
                            "titular": "",  # Por ahora no tenemos el titular
                            "estado": "activa"
                        }
                        # Verificar si la cuenta ya fue procesada
                        if not any(c.get("numero") == cuenta_formateada["numero"] for c in cuentas):
                            cuentas.append(cuenta_formateada)
                            total_cuentas += 1
                            print(f"➡️ Cuenta #{total_cuentas}: {cuenta_formateada['tipo']} - {cuenta_formateada['numero']} - Saldo: ${cuenta_formateada['saldo']:,.0f}")
            
                # Intentar avanzar al siguiente grupo de tarjetas
                try:
                    next_button = page.locator("button[aria-label='Siguiente']")
                    if await next_button.count() > 0 and await next_button.is_visible():
                        await next_button.click()
                        await page.wait_for_timeout(2000)  # Esperar a que carguen las nuevas tarjetas
                    else:
                        break  # No hay más tarjetas para ver
                except Exception as e:
                    print(f"ℹ️ Info al avanzar: {e}")
                    break  # Si hay error al avanzar, asumimos que no hay más tarjetas
            except Exception as e:
                print(f"ℹ️ Info con selector {selector}: {e}")
                continue
        
        # Si no encontramos cuentas, intentar un enfoque alternativo: extraer directamente del HTML
        if not cuentas:
            print("[WARNING] No se encontraron cuentas con métodos estándar. Intentando extracción directa del HTML...")
            try:
                # Evaluar JavaScript para extraer información de tarjetas directamente
                raw_cuentas = await page.evaluate("""
                    () => {
                        try {
                            // Buscar todas las tarjetas o elementos contenedores que podrían ser tarjetas
                            const tarjetas = Array.from(document.querySelectorAll('div[class*="card"], div[class*="producto"], div[class*="cuenta"]'));
                            return tarjetas.map(tarjeta => {
                                const textContent = tarjeta.textContent || '';
                                const textoCompleto = textContent.replace(/\\s+/g, ' ').trim();
                                // Intentar extraer saldo usando expresiones regulares
                                const saldoMatch = textoCompleto.match(/\\$[\\d.,]+/);
                                const saldo = saldoMatch ? saldoMatch[0] : '';
                                
                                // Intentar encontrar nombre o algún texto significativo
                                let nombre = '';
                                const titulos = tarjeta.querySelectorAll('h1, h2, h3, h4, h5, div[class*="title"]');
                                if (titulos.length > 0) {
                                    nombre = titulos[0].textContent.trim();
                                } else {
                                    // Si no hay título, usar el primer texto significativo
                                    const textos = Array.from(tarjeta.querySelectorAll('div, span'))
                                        .map(el => el.textContent.trim())
                                        .filter(texto => texto.length > 3 && texto.length < 50);
                                    if (textos.length > 0) {
                                        nombre = textos[0];
                                    }
                                }
                                
                                // Intentar extraer número de cuenta (buscar secuencias de dígitos largas)
                                let numero = '';
                                const numeroMatch = textoCompleto.match(/\\b\\d{8,}\\b/);
                                if (numeroMatch) {
                                    numero = numeroMatch[0];
                                }
                                
                                return {
                                    nombre: nombre || 'Cuenta sin nombre',
                                    numero: numero,
                                    saldo: saldo,
                                    html: tarjeta.outerHTML.substring(0, 500)  // Incluir parte del HTML para diagnóstico
                                };
                            }).filter(cuenta => cuenta.nombre !== 'Cuenta sin nombre' || cuenta.saldo || cuenta.numero);
                        } catch (e) {
                            console.error('Error en extracción JS:', e);
                            return [];
                        }
                    }
                """)
                
                # Procesar las cuentas extraídas
                for cuenta_raw in raw_cuentas:
                    if not any(c.get("nombre") == cuenta_raw.get("nombre") and c.get("numero") == cuenta_raw.get("numero") for c in cuentas):
                        cuentas.append({
                            "nombre": cuenta_raw.get("nombre", ""),
                            "numero": cuenta_raw.get("numero", ""),
                            "saldo": cuenta_raw.get("saldo", ""),
                            "extraido_html": True
                        })
                        total_cuentas += 1
                        print(f"➡️ Cuenta extraída de HTML #{total_cuentas}: {cuenta_raw.get('nombre')} - {cuenta_raw.get('numero')} - Saldo: {cuenta_raw.get('saldo')}")
            except Exception as e:
                print(f"[WARNING] Error en extracción alternativa: {e}")
        
        # Si aún no encontramos cuentas, tomar una captura completa y fallar
        if not cuentas:       
            raise Exception("No se pudo extraer ninguna cuenta")
        
        print(f"[OK] Se extrajeron {len(cuentas)} cuentas exitosamente")
        return cuentas

    async def extract_ultimos_movimientos(self, page):
        print("\n[🌐]--- Inicio: Extracción de ÚLTIMOS MOVIMIENTOS GENERALES (Home) ---")
        movimientos = []
        unique_mov_keys = set()
        
        try:
            # Reducir timeout de espera inicial de 30s a 20s
            try:
                await page.wait_for_selector("app-ultimos-movimientos-home, div[class*='ultimos-movimientos']", timeout=20000)
                print("[OK] Sección de últimos movimientos encontrada")
            except Exception as e:
                print(f"ERROR: Error esperando sección de movimientos: {str(e)}")
                return []
            
            # Reducir MAX_SCROLL_ATTEMPTS de 5 a 3
            MAX_SCROLL_ATTEMPTS = 3
            scroll_attempt = 0

            while scroll_attempt < MAX_SCROLL_ATTEMPTS:
                print(f"  [🔄] Intento de scroll y extracción #{scroll_attempt + 1}")
                
                try:
                    # Reducir espera post-scroll de 3s a 1.5s
                    await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                    await page.wait_for_timeout(1500)
                    
                    # ... resto del código de extracción de movimientos ...
                except Exception as e_scroll:
                    print(f"    ERROR: Error durante el intento de scroll: {e_scroll}")
                    break
                
                scroll_attempt += 1

            print(f"[OK] Se extrajeron {len(movimientos)} movimientos generales en total.")
            print("[🌐]--- Fin: Extracción de ÚLTIMOS MOVIMIENTOS GENERALES (Home) ---")
            return movimientos
            
        except Exception as e:
            print(f"ERROR: Error al extraer movimientos: {str(e)}")
            return []

    async def extract_movimientos_cuenta(self, page, cuenta_info):
        """Extrae los movimientos de una cuenta específica"""
        movimientos = []
        try:
            print(f"\n[➡️] Iniciando extracción de movimientos para: {cuenta_info.get('nombre', 'Nombre no disponible')} (Num: {cuenta_info.get('numero', 'N/A')})")

            # Verificar que estamos en la página principal
            print(" Verificando que estamos en la página principal (home)...")
            await self.verificar_y_volver_home(page)
            print(" Confirmado: Estamos en la página principal o volvimos exitosamente.")

            # Buscar la tarjeta en el carrusel
            print("\n[🎠] Revisando slide 1/5 del carrusel de productos...")
            carrusel = page.locator("app-carousel-productos")
            if await carrusel.count() == 0:
                raise Exception("No se encontró el carrusel de productos")

            # Obtener todas las tarjetas visibles
            tarjetas = page.locator("app-card-producto:visible, app-card-ahorro:visible")
            num_tarjetas = await tarjetas.count()
            print(f" Encontradas {num_tarjetas} tarjetas visibles en este slide.")

            # Procesar cada tarjeta visible
            for i in range(num_tarjetas):
                print(f"  [💳] Procesando tarjeta visible #{i+1} del slide actual...")
                tarjeta = tarjetas.nth(i)
                
                # Extraer información de la tarjeta actual
                info_tarjeta = await self.extraer_info_tarjeta(tarjeta)
                print(f"    Info tarjeta actual: Nombre='{info_tarjeta.get('nombre', '')}', Numero='{info_tarjeta.get('numero', '')}'")
                print(f"    Info tarjeta objetivo: Nombre='{cuenta_info.get('nombre', '')}', Numero='{cuenta_info.get('numero', '')}'")

                # Verificar si es la tarjeta que buscamos
                if info_tarjeta.get('numero') == cuenta_info.get('numero'):
                    print(f"    [🎯] ¡Tarjeta encontrada!: {info_tarjeta.get('nombre', 'Nombre no disponible')}")
                    
                    # Buscar y hacer clic en el botón de movimientos
                    print("      Buscando botón de 'Movimientos'...")
                    boton_movs = tarjeta.locator("button:has-text('Movimientos')")
                    await boton_movs.click()
                    print("      Botón 'Movimientos' clickeado. Esperando carga de página de movimientos...")
                    
                    # Esperar a que la página de movimientos cargue
                    await page.wait_for_timeout(800)  # Reducido de 1500ms
                    
                    # Verificar que estamos en la página correcta
                    print("        Verificando página de detalle de movimientos...")
                    tabla_movs = page.locator("app-listado-movimientos table")
                    await tabla_movs.wait_for(state="visible", timeout=5000)
                    print("        Confirmado: En página de detalle de movimientos.")
                                
                    # Extraer movimientos
                    print("          Tabla de movimientos encontrada con CSS: app-listado-movimientos table")
                    pagina = 1
                    while True:
                        print(f"            [📄] Procesando página {pagina}/10 de movimientos...")
                        
                        # Esperar a que los movimientos sean visibles
                        await page.wait_for_timeout(300)  # Reducido de 500ms
                        
                        # Extraer movimientos de la página actual
                        filas = await tabla_movs.locator("tbody tr").all()
                        for fila in filas:
                            try:
                                fecha = await fila.locator("td:nth-child(1)").text_content()
                                descripcion = await fila.locator("td:nth-child(2)").text_content()
                                monto_str = await fila.locator("td:nth-child(3)").text_content()
                                
                                # Convertir monto a float
                                monto = self.convertir_saldo_a_float(monto_str)
                                
                                movimiento = {
                                    'fecha': fecha.strip(),
                                    'descripcion': descripcion.strip(),
                                    'monto': monto
                                }
                                movimientos.append(movimiento)
                                print(f"                [+] Movimiento: {fecha} | {descripcion} | {monto}")
                            except Exception as e:
                                print(f"                [WARNING] Error procesando movimiento: {e}")
                                continue
                                            
                        # Intentar ir a la siguiente página
                        print("              Avanzando a la siguiente página de movimientos...")
                        boton_siguiente = page.locator("button.btn-next:not([disabled])")
                        if await boton_siguiente.count() == 0:
                            print("              No hay más páginas de movimientos (botón 'siguiente' no encontrado o deshabilitado).")
                            break
                            
                        await boton_siguiente.click()
                        await page.wait_for_timeout(500)  # Reducido de 1000ms
                        pagina += 1
                        
                        if pagina > 10:  # Límite de seguridad
                            break
                    
                    # Volver a la página principal
                    print("    [🏠] Fin de procesamiento para tarjeta objetivo. Asegurando retorno a Home...")
                    await self.verificar_y_volver_home(page)
                    print("[[OK]] Tarjeta objetivo procesada. Saliendo del bucle del carrusel.")
                    break

            print(f"💰 Total final de movimientos extraídos para '{cuenta_info.get('nombre')}': {len(movimientos)}")
            return movimientos

        except Exception as e:
            print(f"ERROR: Error extrayendo movimientos: {e}")
            return movimientos

    async def login_banco_estado(self, page, credentials: Credentials):
        """Inicia sesión en BancoEstado"""
        try:
            print("🔑 Iniciando proceso de login...")
            
            # Ir a la página de inicio
            print("🌐 Navegando a la página principal...")
            await page.goto('https://www.bancoestado.cl/', timeout=60000)
            await self.espera_aleatoria(page)
            
            # Cerrar modales o sidebars si aparecen
            await self.cerrar_modal_infobar(page) 
            await self.cerrar_sidebar(page)
            
            # PASO 1: Click en "Banca en Línea"
            print("[INFO] Buscando botón 'Banca en Línea'...")
            try:
                # Intentar encontrar el botón de Banca en Línea
                banca_button = None
                banca_selectors = [
                    "a[href*='login'] span:text('Banca en Línea')",
                    "a:has-text('Banca en Línea')",
                    "a[href*='login']"
                ]
                
                for selector in banca_selectors:
                    try:
                        button = await page.wait_for_selector(selector, timeout=5000, state="visible")
                        if button:
                            banca_button = button
                            print(f"[OK] Botón 'Banca en Línea' encontrado con selector: {selector}")
                            break
                    except Exception:
                        continue
                
                if not banca_button:
                    raise Exception("No se pudo encontrar el botón 'Banca en Línea'")
                
                # Simular comportamiento humano antes del click
                await banca_button.hover()
                await page.wait_for_timeout(random.randint(100, 300))
                await banca_button.click()
                print("[OK] Click en 'Banca en Línea' realizado")
                
            except Exception as e:
                print(f"ERROR: Error al hacer click en 'Banca en Línea': {str(e)}")
                raise
            
            # Esperar a que cargue la página de login
            await page.wait_for_load_state("networkidle", timeout=30000)
            await page.wait_for_timeout(2000)  # Espera adicional para asegurar
                                
            # Esperar y preparar campo de RUT
            await page.wait_for_selector("#rut", timeout=10000)
            await page.click("#rut")
            await page.evaluate("document.getElementById('rut').removeAttribute('readonly')")
            
            # Ingresar RUT simulando escritura humana
            print("📝 Ingresando RUT...")
            rut = credentials['rut'] if isinstance(credentials, dict) else credentials.rut
            rut = rut.replace(".", "").replace("-", "").strip().lower()
            await self.type_like_human(page, "#rut", rut, delay=150)
            
            # Preparar e ingresar contraseña
            print("🔒 Ingresando contraseña...")
            password = credentials['password'] if isinstance(credentials, dict) else credentials.password
            await page.click("#pass")
            await page.evaluate("document.getElementById('pass').removeAttribute('readonly')")
            await self.type_like_human(page, "#pass", password, delay=140)
            
            # Simular comportamiento humano antes de enviar
            await self.simular_comportamiento_humano(page)
            await self.espera_aleatoria(page)
            
            # PASO 2: Click en botón "Ingresar"
            print("🔄 Iniciando proceso de login...")
            try:
                # Intentar encontrar el botón usando diferentes selectores
                login_button = None
                ingresar_selectors = [
                    "#btnLogin",
                    "button.msd-button--primary",
                    "button[type='submit']",
                    "button:has-text('Ingresar')",
                    ".msd-button.msd-button--primary",
                    "button.msd-button"
                ]
                
                for selector in ingresar_selectors:
                    try:
                        button = await page.wait_for_selector(selector, timeout=5000, state="visible")
                        if button:
                            login_button = button
                            print(f"[OK] Botón 'Ingresar' encontrado con selector: {selector}")
                            break
                    except Exception:
                        continue
                
                if not login_button:
                    raise Exception("No se pudo encontrar el botón 'Ingresar'")
                
                # Asegurarse que el botón es clickeable
                await login_button.wait_for_element_state("enabled")
                
                # Mover el mouse al botón y hacer una pequeña pausa
                await login_button.hover()
                await page.wait_for_timeout(random.randint(100, 300))
                
                # Intentar diferentes métodos de click
                success = False
                
                # Método 1: Click directo con Playwright
                try:
                    await login_button.click(delay=random.randint(50, 150))
                    success = True
                except Exception as e:
                    print(f"Intento 1 fallido: {e}")
                
                # Método 2: Click via JavaScript si el método 1 falló
                if not success:
                    try:
                        await page.evaluate("""
                            (button) => {
                                button.click();
                                return true;
                            }
                        """, login_button)
                        success = True
                    except Exception as e:
                        print(f"Intento 2 fallido: {e}")
                
                # Método 3: Dispatch event si los anteriores fallaron
                if not success:
                    try:
                        await page.evaluate("""
                            (button) => {
                                const clickEvent = new MouseEvent('click', {
                                    view: window,
                                    bubbles: true,
                                    cancelable: true
                                });
                                button.dispatchEvent(clickEvent);
                                
                                // También intentar submit del formulario
                                const form = button.closest('form');
                                if (form) {
                                    const submitEvent = new Event('submit', {
                                        bubbles: true,
                                        cancelable: true
                                    });
                                    form.dispatchEvent(submitEvent);
                                }
                            }
                        """, login_button)
                        success = True
                    except Exception as e:
                        print(f"Intento 3 fallido: {e}")
                
                if not success:
                    raise Exception("No se pudo hacer click en el botón 'Ingresar'")
                
                # Esperar a que la página cargue completamente
                await page.wait_for_load_state("networkidle", timeout=30000)
                print("[OK] Navegación completada")
                
            except Exception as e:
                print(f"ERROR: Error al intentar hacer click en el botón: {str(e)}")
                raise
            
            # Verificar errores visibles
            modal_error = page.locator("text='ha ocurrido un error'")
            if await modal_error.count() > 0:
                print("[WARNING] Modal de error detectado tras login")
                raise Exception("ERROR: Error visible en pantalla después de iniciar sesión")
            
            # Esperar y verificar errores en el contenido
            await page.wait_for_timeout(7000)
            content = await page.content()
            errores = [
                "clave incorrecta",
                "rut incorrecto",
                "ha ocurrido un error",
                "usuario bloqueado",
                "intentos excedidos"
            ]
            
            if any(e in content.lower() for e in errores):
                error_msg = next((e for e in errores if e in content.lower()), "Error general al iniciar sesión")
                raise Exception(f"ERROR: {error_msg.capitalize()}")
            
            # Verificar que estamos en la página correcta después del login
            current_url = page.url
            print(f"📍 URL actual: {current_url}")
            
            # Intentar detectar elementos que indiquen login exitoso
            try:
                # Esperar por elementos que típicamente aparecen después del login
                success_selectors = [
                    "app-carrusel-productos-wrapper",
                    "app-card-producto",
                    "app-ultimos-movimientos-home",
                    ".dashboard-container",
                    "#dashboard"
                ]
                
                for selector in success_selectors:
                    try:
                        await page.wait_for_selector(selector, timeout=5000)
                        print(f"[OK] Login confirmado: Elemento {selector} encontrado")
                        return content
                    except Exception:
                        continue
                
                # Si no encontramos ningún elemento de éxito, verificar la URL
                if any(x in current_url.lower() for x in ["personas/home", "personas/inicio", "#home", "dashboard"]):
                    print("[OK] Login confirmado por URL")
                    return content
                    
                print(f"[WARNING] URL inesperada después del login: {current_url}")
                raise Exception("ERROR: Redirección incorrecta después del login")
                
            except Exception as e:
                print(f"ERROR: Error verificando login exitoso: {str(e)}")
                raise
            
        except Exception as e:
            print(f"ERROR: Error durante el login: {str(e)}")
            raise Exception(f"Error durante el login: {str(e)}")
            

    def guardar_en_json(self, nombre_archivo: str, data: dict):
        path = os.path.join(self.config.results_dir, nombre_archivo)
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"💾 Resultado guardado localmente en {path}")

    def convertir_saldo_a_float(self, saldo_str: str) -> float:
        """Convierte un string de saldo (ej: '$123.456') a float"""
        try:
            # Remover el símbolo de peso y cualquier espacio
            saldo_str = saldo_str.replace('$', '').replace(' ', '')
            
            # Remover puntos de miles y reemplazar coma decimal por punto
            saldo_str = saldo_str.replace('.', '').replace(',', '.')
            
            # Convertir a float
            return float(saldo_str or '0')
        except Exception as e:
            print(f"ERROR: Error al convertir saldo: {e}")
            return 0