import json
import random
import redis
import os
import re
from datetime import datetime
from playwright.async_api import async_playwright
from utils.redis_client import get_task, store_result
from dataclasses import dataclass
from typing import Optional

@dataclass
class ScraperConfig:
    redis_host: str = 'localhost'
    redis_port: int = 6379
    results_dir: str = "results"
    debug_dir: str = "debug"
    geolocation: dict = None
    
    def __post_init__(self):
        self.debug_dir = os.path.join(self.results_dir, "debug")
        os.makedirs(self.results_dir, exist_ok=True)
        os.makedirs(self.debug_dir, exist_ok=True)
        if self.geolocation is None:
            self.geolocation = {
                "latitude": -33.4489,
                "longitude": -70.6693
            }
@dataclass
class Credentials:
    rut: str
    password: str

class BancoEstadoScraper:
    def __init__(self, config: Optional[ScraperConfig] = None):
        self.config = config or ScraperConfig()
        self.redis_client = redis.Redis(
            host=self.config.redis_host, 
            port=self.config.redis_port, 
            decode_responses=True
        )

    async def run(self):
        print("[🚀 Scraper BancoEstado iniciado. Esperando tareas...]")

        while True:
            task = get_task(self.redis_client, "scraper:task")
            if not task:
                continue
            try:
                payload = json.loads(task)

                # Validar que sea una tarea para este scraper si viene el campo 'site'
                if 'site' in payload and payload['site'] != 'banco_estado':
                    continue
                
                # Obtener credenciales del payload
                credentials = Credentials(
                    rut=payload.get("rut") or payload.get("username"),  # acepta tanto rut como username
                    password=payload.get("password")
                )
    
                if not credentials.rut or not credentials.password:
                    raise ValueError("Credenciales incompletas: Se requiere RUT/username y contraseña")

                print(f"\n📨 Nueva tarea recibida para RUT: {credentials.rut}")

                async with async_playwright() as p:
                    # Configuración del navegador (headless=True para ejecutar sin interfaz visible)
                    browser = await p.chromium.launch(headless=True, slow_mo=150)
                    context = await browser.new_context(
                        accept_downloads=True,
                        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                        locale="es-CL",
                        permissions=["geolocation"],
                        geolocation=self.config.geolocation,
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
                    
                    # 1. Login
                    content = await self.login_banco_estado(page, credentials)
                    print("🔓 Login exitoso")
                    
                    # 2. Cerrar sidebars y modales
                    await self.cerrar_sidebar(page)
                    await self.cerrar_modal_infobar(page)
                    
                    # 3. Extraer información de cuentas y mostrar saldos
                    print("🔍 Extrayendo información de cuentas...")
                    await self.mostrar_saldos(page)
                    await page.wait_for_timeout(1000)
                    cuentas = await self.extract_cuentas(page)
                    
                    # 4. Extraer últimos movimientos
                    print("🔍 Extrayendo últimos movimientos...")
                    ultimos_movimientos = await self.extract_ultimos_movimientos(page)
                    
                    # 5. Extraer movimientos de cada cuenta
                    print("🔍 Extrayendo movimientos de cada cuenta...")
                    for cuenta in cuentas:
                        movimientos_cuenta = await self.extract_movimientos_cuenta(page, cuenta)
                        if movimientos_cuenta:
                            cuenta['movimientos'] = movimientos_cuenta
                        else:
                            cuenta['movimientos'] = []
                    
                    # 6. Preparar resultado
                    result = {
                        "success": True,
                        "cuentas": cuentas,
                        "ultimos_movimientos": ultimos_movimientos,
                        "fecha_extraccion": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    }

                    # 7. Guardar resultados
                    store_result(self.redis_client, f"scraper:response:{credentials.rut}", result)
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                    self.guardar_en_json(f"{credentials.rut}_{timestamp}.json", result)
                    
                    await browser.close()
                    print("🧹 Navegador cerrado correctamente")

            except Exception as e:
                print(f"[❌ ERROR] {str(e)}")
                error_result = {
                    "success": False,
                    "message": str(e)
                }
                if 'credentials' in locals():
                    store_result(self.redis_client, f"scraper:response:{credentials.rut}", error_result)

    async def espera_aleatoria(self, page):
        base_time = random.randint(400, 600)
        jitter = random.randint(-100, 100)
        await page.wait_for_timeout(base_time + jitter)

    async def cerrar_modal_infobar(self, page):
        try:
            # Primero intentar cerrar usando JavaScript
            await page.evaluate("""
                const closeButtons = Array.from(document.querySelectorAll('button[aria-label*="Close"]'));
                for (const button of closeButtons) {
                    if (button.offsetParent !== null) {  // Verificar si es visible
                        button.click();
                    }
                }
            """)
            await page.wait_for_timeout(500)
            
            # Si aún existe el botón, intentar el método tradicional
            modal_btn = page.locator("button.evg-btn-dismissal[aria-label*='Close']")
            if await modal_btn.count() > 0:
                try:
                    # Intentar hacer scroll al botón
                    await modal_btn.scroll_into_view_if_needed()
                    await page.wait_for_timeout(500)
                    await modal_btn.click(timeout=5000)
                    print("🔕 Modal de infobar cerrado")
                except Exception:
                    print("⚠️ No se pudo cerrar el modal de infobar usando click")
            else:
                print("✅ No apareció el modal de infobar")
        except Exception as e:
            print(f"ℹ️ Info al intentar cerrar el modal: {e}")

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
                        print(f"🔕 Sidebar {sidebar_id} cerrado")
                        await page.wait_for_timeout(1000)
                        return True
                except Exception:
                    continue
            # Intentar cerrar sidebars por clase común
            try:
                sidebar_class = page.locator(".sidebar-container button[aria-label='Cerrar'], .modal-container button[aria-label='Cerrar']")
                if await sidebar_class.count() > 0 and await sidebar_class.is_visible():
                    await sidebar_class.click()
                    print("🔕 Sidebar genérico cerrado")
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
                                print("🔕 Sidebar/modal cerrado")
                                await page.wait_for_timeout(1000)
                                return True
                    except Exception:
                        continue
            except Exception:
                pass
            print("✅ No hay sidebars para cerrar")
            return False
        except Exception as e:
            print(f"ℹ️ Info: {str(e)}")
            return False

    async def type_like_human(self, page, selector, text):
        for char in text:
            await page.type(selector, char, delay=random.randint(20, 70))
            if random.random() < 0.06:  # 5% de probabilidad de pausa
                await page.wait_for_timeout(random.randint(50, 150))

    async def simular_comportamiento_humano(self, page):
        # Movimientos aleatorios del mouse (solo uno en modo headless para mantener algo de aleatoriedad)
        for _ in range(1):
            x = random.randint(100, 800)
            y = random.randint(100, 600)
            await page.mouse.move(x, y, steps=random.randint(3, 5))
            await page.wait_for_timeout(random.randint(50, 150))
        # Scroll aleatorio
        await page.evaluate("""
            window.scrollTo({
                top: Math.random() * document.body.scrollHeight,
                behavior: 'smooth'
            });
        """)
        await page.wait_for_timeout(random.randint(500, 1000))

    async def mostrar_saldos(self, page):
        try:
            # Intentar cerrar cualquier sidebar antes de interactuar
            await self.cerrar_sidebar(page)
            print("👁️ Intentando mostrar saldos...")
            
            # Método 1: Usando el selector #showMonto
            try:
                # Esperar a que el switch esté disponible con un timeout mayor
                await page.wait_for_selector("#showMonto", timeout=30000)
                # Intentar hacer click usando JavaScript
                await page.evaluate("""
                    const switchElement = document.querySelector('#showMonto');
                    if (switchElement) {
                        switchElement.click();
                        console.log('Click en #showMonto');
                    } else {
                        console.log('No se encontró #showMonto');
                    }
                """)
                await page.wait_for_timeout(5000)  # Esperar a que los saldos se muestren
            except Exception as e:
                print(f"ℹ️ Info al intentar método 1: {e}")
            
            # Método 2: Intentar con otros selectores comunes
            if not await self.verificar_saldos_visibles(page):
                print("⚠️ Intentando método alternativo 2...")
                try:
                    # Intentar otros selectores comunes para el switch de mostrar saldos
                    selectores_switch = [
                        "label.switch input[type='checkbox']",
                        "div.switch input",
                        "mat-slide-toggle",
                        "button[class*='visibility']",
                        "button[class*='eye']",
                        "button[aria-label*='Mostrar']",
                        "span[class*='eye']"
                    ]
                    
                    for selector in selectores_switch:
                        try:
                            switch_elements = await page.locator(selector).all()
                            if switch_elements:
                                for switch in switch_elements:
                                    if await switch.is_visible():
                                        await switch.click()
                                        print(f"✅ Click en switch con selector: {selector}")
                                        await page.wait_for_timeout(3000)
                                        if await self.verificar_saldos_visibles(page):
                                            return
                        except Exception:
                            continue
                except Exception as e:
                    print(f"ℹ️ Info al intentar método 2: {e}")
            
            # Método 3: Buscar elementos con texto relevante
            if not await self.verificar_saldos_visibles(page):
                print("⚠️ Intentando método alternativo 3...")
                try:
                    # Evaluar JavaScript para buscar y hacer clic en elementos relacionados con mostrar saldos
                    await page.evaluate("""
                        () => {
                            // Función para verificar si un elemento está relacionado con mostrar saldos
                            const esElementoMostrarSaldo = (el) => {
                                const texto = (el.textContent || '').toLowerCase();
                                const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
                                const id = (el.id || '').toLowerCase();
                                const clases = (el.className || '').toLowerCase();
                                
                                return (
                                    texto.includes('mostrar') || texto.includes('ocultar') || 
                                    texto.includes('ver') || texto.includes('saldo') ||
                                    ariaLabel.includes('mostrar') || ariaLabel.includes('ocultar') ||
                                    ariaLabel.includes('ver') || ariaLabel.includes('saldo') ||
                                    id.includes('show') || id.includes('view') || id.includes('toggle') ||
                                    clases.includes('eye') || clases.includes('visibility')
                                );
                            };
                            
                            // Buscar todos los elementos clicables
                            const elementos = [
                                ...document.querySelectorAll('button, div[role="button"], span[role="button"], label, input[type="checkbox"]')
                            ];
                            
                            // Filtrar por visibilidad y relevancia
                            const elementosRelevantes = elementos.filter(el => {
                                const rect = el.getBoundingClientRect();
                                const visible = rect.width > 0 && rect.height > 0 && 
                                              window.getComputedStyle(el).display !== 'none' && 
                                              window.getComputedStyle(el).visibility !== 'hidden';
                                return visible && esElementoMostrarSaldo(el);
                            });
                            
                            console.log(`Encontrados ${elementosRelevantes.length} elementos potenciales para mostrar saldos`);
                            
                            // Hacer clic en elementos relevantes
                            elementosRelevantes.forEach(el => {
                                try {
                                    console.log(`Haciendo clic en: ${el.outerHTML.substring(0, 100)}`);
                                    el.click();
                                } catch (err) {
                                    console.error(`Error haciendo clic en ${el.tagName}:`, err);
                                }
                            });
                            
                            return elementosRelevantes.length;
                        }
                    """)
                    await page.wait_for_timeout(3000)
                except Exception as e:
                    print(f"ℹ️ Info al intentar método 3: {e}")
            
            # Verificar si los saldos se mostraron correctamente
            if await self.verificar_saldos_visibles(page):
                print("✅ Saldos mostrados correctamente")
            else:
                print("⚠️ Los saldos no se mostraron, continuando de todos modos...")
                
        except Exception as e:
            print(f"ℹ️ Info al intentar mostrar saldos: {e}")
            
    async def verificar_saldos_visibles(self, page):
        try:
            # Buscar elementos que podrían contener saldos visibles
            saldos_locators = [
                "div[class*='__saldo'] div:not(:has-text('*********'))",
                "div[class*='saldo']:not(:has-text('*********'))",
                "div[class*='amount']:not(:has-text('*********'))",
                "span[class*='amount']:not(:has-text('*********'))"
            ]
            
            for locator in saldos_locators:
                count = await page.locator(locator).count()
                if count > 0:
                    return True
            
            # Verificar usando JavaScript
            return await page.evaluate("""
                () => {{
                    // Buscar texto que parezca un saldo (formato monetario)
                    const saldoRegex = /\\$[\\d.,]+/;
                    const elementos = document.querySelectorAll('div, span');
                    for (const el of elementos) {{
                        const texto = el.textContent || '';
                        if (saldoRegex.test(texto) && !texto.includes('*********')) {{
                            return true;
                        }}
                    }}
                    return false;
                }}
            """)
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
                print(f"⚠️ Error al extraer nombre con selectores h3 directos: {e}")
            
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
                    print(f"⚠️ Error al extraer nombre con selector alternativo .m-card-global__header--title h3: {e_alt}")
            
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
                    print(f"⚠️ Error al extraer nombre del HTML: {e}")
            
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
                print(f"⚠️ Error al extraer número: {e}")
            
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
                                const match = texto.match(saldoRegex);
                                if (match) return match[0];
                            }
                            return "";
                        }
                    """)
            except Exception as e:
                info["saldo"] = ""
                print(f"⚠️ Error al extraer saldo: {e}")
            
            # Verificar que tengamos información mínima
            if not info["nombre"] or info["nombre"] == "Cuenta sin nombre":
                if not info["numero"] and not info["saldo"]:
                    return None
            
            return info
        except Exception as e:
            print(f"❌ Error general al extraer info de tarjeta: {e}")
            return None

    async def extract_cuentas(self, page):
        print("🔍 Extrayendo cuentas...")
        await self.cerrar_modal_infobar(page)
        
        # Tomar screenshot de la página completa para diagnóstico
        # try:
        #     timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        #     screenshot_path = os.path.join(self.config.debug_dir, f"page_before_extract_{timestamp}.png")
        #     await page.screenshot(path=screenshot_path)
        #     print(f"📸 Screenshot de página guardado en {screenshot_path}")
        # except Exception as e:
        #     print(f"⚠️ No se pudo tomar screenshot: {e}")
        
        # Esperar a que el carrusel esté presente con un timeout mayor
        try:
            await page.wait_for_selector("app-carrusel-productos-wrapper", timeout=30000)
            print("🔍 Encontramos el carrusel")
        except Exception as e:
            print(f"⚠️ No se encontró el carrusel: {e}")
            # Intentar un selector alternativo más genérico
            try:
                await page.wait_for_selector("div[role='list'], div.carousel, div.slider", timeout=15000)
                print("🔍 Encontramos un carrusel alternativo")
            except Exception as e2:
                print(f"⚠️ No se encontró ningún carrusel: {e2}")
                # Capturar screenshot de diagnóstico
                # try:
                #     timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                #     screenshot_path = os.path.join(self.config.debug_dir, f"no_carousel_found_{timestamp}.png")
                #     await page.screenshot(path=screenshot_path)
                #     print(f"📸 Screenshot guardado en {screenshot_path}")
                # except Exception:
                #     pass
                
        # Intentar cerrar cualquier sidebar o modal
        await self.cerrar_sidebar(page)
        
        # Intentar mostrar los saldos
        await self.mostrar_saldos(page)
        
        # Esperar a que las tarjetas estén visibles, con múltiples selectores posibles
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
                print(f"✅ Tarjetas encontradas con selector: {selector}")
                tarjetas_encontradas = True
                break
            except Exception:
                print(f"⚠️ No se encontraron tarjetas con selector: {selector}")
                continue
        
        if not tarjetas_encontradas:
            # Si no encontramos tarjetas con ningún selector, tomar screenshot y fallar graciosamente
            # try:
            #     timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            #     screenshot_path = os.path.join(self.config.debug_dir, f"no_cards_found_{timestamp}.png")
            #     await page.screenshot(path=screenshot_path)
            #     print(f"📸 Screenshot guardado en {screenshot_path}")
            # except Exception:
            #     pass
            # Intentar continuar de todos modos
            print("⚠️ No se encontraron tarjetas con ningún selector")
        
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
                        # Verificar si la cuenta ya fue procesada
                        if not any(c.get("numero") == cuenta_info.get("numero") for c in cuentas):
                            cuentas.append(cuenta_info)
                            total_cuentas += 1
                            print(f"➡️ Cuenta #{total_cuentas}: {cuenta_info['nombre']} - {cuenta_info['numero']} - Saldo: {cuenta_info['saldo']}")
            
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
            print("⚠️ No se encontraron cuentas con métodos estándar. Intentando extracción directa del HTML...")
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
                print(f"⚠️ Error en extracción alternativa: {e}")
        
        # Si aún no encontramos cuentas, tomar una captura completa y fallar
        if not cuentas:
            # Tomar captura de pantalla final para diagnóstico
            # try:
            #     timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            #     screenshot_path = os.path.join(self.config.debug_dir, f"final_no_accounts_{timestamp}.png")
            #     await page.screenshot(path=screenshot_path, full_page=True)
            #     print(f"📸 Screenshot final guardado en {screenshot_path}")
                
            #     # Guardar el HTML para análisis
            #     html_path = os.path.join(self.config.debug_dir, f"page_html_{timestamp}.html")
            #     html_content = await page.content()
            #     with open(html_path, "w", encoding="utf-8") as f:
            #         f.write(html_content)
            #     print(f"📄 HTML guardado en {html_path}")
            # except Exception as e:
            #     print(f"⚠️ No se pudo guardar diagnóstico final: {e}")
                
            raise Exception("No se pudo extraer ninguna cuenta")
        
        print(f"✅ Se extrajeron {len(cuentas)} cuentas exitosamente")
        return cuentas

    async def extract_ultimos_movimientos(self, page):
        print("\n[🌐]--- Inicio: Extracción de ÚLTIMOS MOVIMIENTOS GENERALES (Home) ---")
        movimientos = []
        unique_mov_keys = set() # Para evitar duplicados si el scroll recarga los mismos items
        
        try:
            # Esperar a que aparezca la sección de últimos movimientos (nuevo selector)
            try:
                await page.wait_for_selector("app-ultimos-movimientos-home, div[class*='ultimos-movimientos']", timeout=15000)
                print("✅ Sección de últimos movimientos encontrada")
            except Exception as e:
                print(f"⚠️ No se encontró la sección de últimos movimientos: {e}")
                # timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                # screenshot_path = os.path.join(self.config.debug_dir, f"no_movimientos_section_{timestamp}.png")
                # await page.screenshot(path=screenshot_path)
                # print(f"📸 Screenshot guardado en: {screenshot_path}")
                return []
            
            # Selector principal para los items de movimiento individuales
            # Basado en el HTML: div.list-item-movimiento dentro de div.list-movimiento
            movimiento_item_selector = "div.list-movimiento div.list-item-movimiento"
            
            # Contenedor de scroll identificado desde el HTML
            scroll_container_selector = "div.msd-container-scroll__content"

            # Función para extraer movimientos de la vista actual
            async def extraer_movimientos_de_la_vista_actual():
                nonlocal movimientos # Para modificar la lista externa
                nonlocal unique_mov_keys
                items_agregados_en_esta_pasada = 0

                mov_elements = await page.locator(movimiento_item_selector).all()
                print(f"    🔍 Encontrados {len(mov_elements)} elementos de movimiento en la vista actual.")

                for item_element in mov_elements:
                    try:
                        movimiento_data = await item_element.evaluate("""
                            item => {
                                let fecha = "";
                                const fechaEl = item.querySelector('.list-item-movimiento__fecha');
                                if (fechaEl) fecha = fechaEl.textContent.trim();

                                let descripcion = "";
                                const descEl = item.querySelector('.list-item-movimiento__glosa');
                                if (descEl) descripcion = descEl.textContent.trim();

                                let monto = "";
                                const montoEl = item.querySelector('.list-item-movimiento__monto');
                                let esAbono = false;
                                if (montoEl) {
                                    monto = montoEl.textContent.trim();
                                    if (montoEl.querySelector('.green_text') || monto.includes('+')) {
                                        esAbono = true;
                                    }
                                }
                                return {fecha, descripcion, monto, esAbono};
                            }
                        """)

                        if not movimiento_data or not movimiento_data.get('fecha') or not movimiento_data.get('monto'):
                            print(f"    ⚠️ Datos incompletos para un movimiento: {movimiento_data}")
                            continue

                        monto_str_cleaned = movimiento_data['monto'].replace('$', '').replace('.', '').replace(',', '.').replace('+', '').replace('-', '').strip()
                        if not monto_str_cleaned:
                            continue
                        
                        monto_valor = float(monto_str_cleaned)
                        tipo_mov = "abono"
                        if movimiento_data['esAbono']:
                            pass
                        elif '-' in movimiento_data['monto']:
                            monto_valor = -monto_valor
                            tipo_mov = "cargo"
                        else: # Asumir cargo si no hay indicio explícito de abono y no es negativo ya
                            monto_valor = -monto_valor
                            tipo_mov = "cargo"

                        mov_key = f"{movimiento_data['fecha']}_{movimiento_data['descripcion']}_{monto_valor}_{tipo_mov}"

                        if mov_key not in unique_mov_keys:
                            movimiento = {
                                "fecha": movimiento_data['fecha'],
                                "descripcion": movimiento_data['descripcion'],
                                "monto": monto_valor,
                                "tipo": tipo_mov
                            }
                            movimientos.append(movimiento)
                            unique_mov_keys.add(mov_key)
                            items_agregados_en_esta_pasada += 1
                            # print(f"    ✅ Movimiento general extraído: {movimiento['fecha']} - {movimiento['descripcion']} - {movimiento['monto']}")
                        # else:
                            # print(f"    ℹ️ Movimiento duplicado omitido: {mov_key}")

                    except Exception as e_item:
                        print(f"    ❌ Error procesando un item de movimiento general: {str(e_item)}")
                        # Intenta capturar el HTML del item para depuración
                        try:
                            item_html = await item_element.inner_html()
                            print(f"        HTML del item con error: {item_html[:200]}...") # Muestra los primeros 200 caracteres
                        except Exception as e_html_item:
                            print(f"        No se pudo obtener el HTML del item: {e_html_item}")
                return items_agregados_en_esta_pasada

            # --- Lógica de Scroll --- 
            MAX_SCROLL_ATTEMPTS = 15 # Aumentar intentos de scroll
            scroll_attempt = 0
            last_mov_count = 0

            while scroll_attempt < MAX_SCROLL_ATTEMPTS:
                print(f"  [🔄] Intento de scroll y extracción #{scroll_attempt + 1}")
                await extraer_movimientos_de_la_vista_actual()
                
                current_mov_count = len(movimientos)
                print(f"    Total movimientos generales hasta ahora: {current_mov_count}")

                # Intentar hacer scroll dentro del contenedor específico
                try:
                    scroll_container_present = await page.locator(scroll_container_selector).count() > 0
                    if not scroll_container_present:
                        print("    ⚠️ Contenedor de scroll no encontrado. No se puede hacer más scroll.")
                        break

                    # Obtener la altura actual del scrollable content
                    last_scroll_height = await page.evaluate(f"document.querySelector('{scroll_container_selector}').scrollHeight")
                    
                    await page.evaluate(f"""
                        const container = document.querySelector('{scroll_container_selector}');
                        if (container) {{
                            container.scrollTo(0, container.scrollHeight);
                        }}
                    """)
                    await page.wait_for_timeout(3000) # Esperar a que cargue el nuevo contenido y animaciones

                    new_scroll_height = await page.evaluate(f"document.querySelector('{scroll_container_selector}').scrollHeight")

                    if new_scroll_height == last_scroll_height and current_mov_count == last_mov_count:
                        print("    ✅ Scroll no cargó nuevos movimientos y la altura no cambió. Asumiendo fin de la lista.")
                        break 
                    last_mov_count = current_mov_count

                except Exception as e_scroll:
                    print(f"    ❌ Error durante el intento de scroll: {e_scroll}")
                    # Tomar screenshot en caso de error de scroll
                    # timestamp_scroll_err = datetime.now().strftime("%Y%m%d_%H%M%S")
                    # path_scroll_err = os.path.join(self.config.debug_dir, f"error_scroll_ultimos_mov_{timestamp_scroll_err}.png")
                    # await page.screenshot(path=path_scroll_err)
                    # print(f"    📸 Screenshot de error de scroll guardado en {path_scroll_err}")
                    break # Salir del bucle de scroll si hay un error grave
                
                scroll_attempt += 1
                if scroll_attempt == MAX_SCROLL_ATTEMPTS:
                    print("    ⚠️ Alcanzado el número máximo de intentos de scroll.")

            print(f"✅ Se extrajeron {len(movimientos)} movimientos generales en total.")
            print("[🌐]--- Fin: Extracción de ÚLTIMOS MOVIMIENTOS GENERALES (Home) ---")
            return movimientos
            
        except Exception as e:
            print(f"❌ Error al extraer movimientos: {str(e)}")
            # Guardar screenshot para debug con timestamp
            # timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            # screenshot_path = os.path.join(self.config.debug_dir, f"ultimos_movimientos_{timestamp}.png")
            # await page.screenshot(path=screenshot_path)
            # print(f"📸 Screenshot guardado en: {screenshot_path}")
            return []

    async def extract_movimientos_cuenta(self, page, cuenta_info):
        print(f"\n[➡️] Iniciando extracción de movimientos para: {cuenta_info.get('nombre', 'Nombre no disponible')} (Num: {cuenta_info.get('numero', 'N/A')})")
        movimientos_extraidos_list = []
        found_target_card_and_processed = False

        try:
            # 1. Asegurar que estamos en la página principal (home) antes de empezar.
            print(" Verificando que estamos en la página principal (home)...")
            current_url_check = page.url.lower()
            is_on_home = "home" in current_url_check and "movimiento-detalle" not in current_url_check # Asegurar que no sea una URL de detalle que contenga "home"
            
            if not is_on_home:
                print(f" URL actual: {page.url}. No estamos en Home.")
                try:
                    # Si estamos en una página de detalle, intentar retroceder primero
                    if "movimiento-detalle" in current_url_check or "movimientos" in current_url_check: # Agregado "movimientos" como posible pág de detalle
                        print(" Intentando page.go_back() para volver a Home desde detalle...")
                        await page.go_back(timeout=15000, wait_until="domcontentloaded")
                        await page.wait_for_timeout(3000) # Espera para estabilización
                        # Re-verificar si ahora estamos en home
                        if "home" in page.url.lower() and "movimiento-detalle" not in page.url.lower():
                            print(" Volvimos a Home con page.go_back().")
                            is_on_home = True
                        else:
                            print(f" page.go_back() no nos llevó a Home. URL actual: {page.url}")
                except Exception as e_goback_init:
                    print(f" Error durante page.go_back() inicial: {e_goback_init}")
            
            if not is_on_home: # Si go_back falló o no era aplicable, forzar navegación a /home
                print(" Intentando navegar a Home forzadamente (https://www.bancoestado.cl/home).")
                try:
                    await page.goto("https://www.bancoestado.cl/home", timeout=20000, wait_until="domcontentloaded")
                    await page.wait_for_selector("app-carrusel-productos-wrapper", timeout=15000) # Re-verificar
                    print(" Navegación a Home forzada exitosa.")
                    is_on_home = True # Asumimos que estamos en home si la navegación y el selector funcionaron
                except Exception as e_goto_home_init:
                    print(f" Error CRÍTICO al forzar navegación a Home al inicio: {e_goto_home_init}")
                    # Si no podemos llegar a Home, es mejor no continuar con esta cuenta.
                    return []
            
            if is_on_home:
                 print(" Confirmado: Estamos en la página principal o volvimos exitosamente.")
            else:
                print(" ALERTA: No se pudo confirmar que estamos en la página Home. Procediendo con cautela...")
                # Considerar retornar [] si es crítico estar en home aquí.

            # 2. Cerrar sidebars y modales que puedan interferir.
            await self.cerrar_sidebar(page)
            await self.cerrar_modal_infobar(page)

            MAX_CAROUSEL_SLIDES = 5  # Intentos máximos para avanzar en el carrusel.
            for slide_attempt in range(MAX_CAROUSEL_SLIDES):
                print(f"\n[🎠] Revisando slide {slide_attempt + 1}/{MAX_CAROUSEL_SLIDES} del carrusel de productos...")
                
                # Obtener todas las tarjetas visibles en el slide actual del carrusel
                try:
                    await page.wait_for_selector("app-card-producto:visible, app-card-ahorro:visible", timeout=10000)
                    visible_cards = await page.locator("app-card-producto:visible, app-card-ahorro:visible").all()
                    if not visible_cards:
                        print(" Alerta: No se encontraron tarjetas visibles en este slide del carrusel.")
                        # Si no hay tarjetas visibles, intentar avanzar el carrusel podría ser la única opción o podría ser el final.
                    else:
                         print(f" Encontradas {len(visible_cards)} tarjetas visibles en este slide.")
                except Exception as e_fetch_cards:
                    print(f" Error al obtener tarjetas visibles del carrusel (slide {slide_attempt + 1}): {e_fetch_cards}")
                    # Tomar screenshot si falla la carga de tarjetas
                    # ts_error_cards = datetime.now().strftime("%Y%m%d_%H%M%S")
                    # await page.screenshot(path=os.path.join(self.config.debug_dir, f"error_fetch_cards_slide{slide_attempt+1}_{ts_error_cards}.png"))
                    break # Salir del bucle del carrusel si no podemos obtener tarjetas


                for card_idx, card_element in enumerate(visible_cards):
                    print(f"  [💳] Procesando tarjeta visible #{card_idx + 1} del slide actual...")
                    # El bloque try-finally aquí es para la lógica de una tarjeta específica y el retorno a HOME
                    try:
                        # Extraer info de la tarjeta actual para compararla
                        card_data_actual = await self.extraer_info_tarjeta(card_element) # Usar la función existente
                        if not card_data_actual:
                            print("    No se pudo extraer información de esta tarjeta visible. Saltando.")
                            continue
                        
                        nombre_tarjeta_actual = card_data_actual.get('nombre', '').strip().lower()
                        numero_tarjeta_actual = card_data_actual.get('numero', '').strip()
                        
                        print(f"    Info tarjeta actual: Nombre='{nombre_tarjeta_actual}', Numero='{numero_tarjeta_actual}'")
                        print(f"    Info tarjeta objetivo: Nombre='{cuenta_info.get('nombre','').strip().lower()}', Numero='{cuenta_info.get('numero','').strip()}'")

                        # Verificar si es la tarjeta objetivo
                        es_tarjeta_objetivo = False
                        if cuenta_info.get('numero') and numero_tarjeta_actual and cuenta_info['numero'].strip() in numero_tarjeta_actual:
                            es_tarjeta_objetivo = True
                        elif not cuenta_info.get('numero') and nombre_tarjeta_actual == cuenta_info.get('nombre','').strip().lower(): 
                            # Comparar por nombre solo si el número de la cuenta objetivo no está disponible
                            es_tarjeta_objetivo = True
                        
                        if es_tarjeta_objetivo:
                            print(f"    [🎯] ¡Tarjeta encontrada!: {card_data_actual.get('nombre')}")
                            found_target_card_and_processed = True # Marcar que encontramos y procesaremos

                            # Hacer clic en el botón de "Movimientos"
                            print("      Buscando botón de 'Movimientos'...")
                            movimientos_btn = card_element.locator("button:has-text('Movimientos'), button:has-text('Saldos y movs.')")
                            if await movimientos_btn.count() == 0:
                                print("      Error: No se encontró el botón de 'Movimientos' en la tarjeta.")
                                continue # Continuar con la siguiente tarjeta visible (aunque ya encontramos la correcta)
                            
                            await movimientos_btn.first.click()
                            print("      Botón 'Movimientos' clickeado. Esperando carga de página de movimientos...")
                            await page.wait_for_timeout(5000) # Espera para navegación/carga

                            # --- INICIO EXTRACCIÓN DE MOVIMIENTOS EN PÁGINA DE DETALLE ---
                            try:
                                print("        Verificando página de detalle de movimientos...")
                                await page.wait_for_selector("app-movimiento-detalle, app-listado-movimientos, [class*='movimiento-container']", timeout=15000)
                                print("        Confirmado: En página de detalle de movimientos.")
                                
                                tabla_selector = None
                                tabla_selectors_css = [
                                    "app-listado-movimientos table", "table.movimientos-table",
                                    "[class*='movimientos'] table", "table[role='grid']", "table" 
                                ]
                                for ts_candidate in tabla_selectors_css:
                                    if await page.locator(ts_candidate).count() > 0:
                                        if await page.locator(f"{ts_candidate} tbody tr, {ts_candidate} tr[role='row']").count() > 0:
                                            tabla_selector = ts_candidate
                                            print(f"          Tabla de movimientos encontrada con CSS: {tabla_selector}")
                                            break
                                
                                if not tabla_selector:
                                    print("          No se encontró tabla con CSS. Intentando JS fallback para detectar tabla...")
                                    tabla_selector = await page.evaluate(
                                        """
                                        () => {
                                            const python_generic_date_regex_str = r"\d{2}(\/|-)\d{2}(\/|-)\d{4}"; // Python raw string
                                            const fechaRegex = new RegExp(python_generic_date_regex_str); // JS RegExp object
                                            const commonTableAreas = ['table', 'app-listado-movimientos', '[class*="movimiento"]', '[role="grid"]', '[role="list"]'];
                                            for (const areaSelector of commonTableAreas) {
                                                const elements = Array.from(document.querySelectorAll(areaSelector));
                                                for (const el of elements) {
                                                    if (fechaRegex.test(el.textContent || '')) {
                                                        let sel = el.tagName.toLowerCase();
                                                        if (el.id) sel += `#${el.id}`;
                                                        else if (el.className && typeof el.className === 'string' && el.className.trim()) sel += `.${el.className.trim().split(' ')[0]}`;
                                                        // Check if this selector is specific enough or too generic
                                                        if (sel !== 'table' && sel !== 'div' && document.querySelectorAll(sel).length === 1) return sel;
                                                        if (el.tagName === 'TABLE') return sel; // Prefer table tag if found
                                                    }
                                                }
                                            }
                                            return null; // No suitable element found
                                        }
                                        """
                                    )
                                    if tabla_selector:
                                        print(f"          Tabla/lista de movimientos encontrada con JS fallback: {tabla_selector}")
                                    else:
                                        print("          Error CRÍTICO: No se pudo encontrar la tabla de movimientos ni con CSS ni con JS.")
                                        # await page.screenshot(path=os.path.join(self.config.debug_dir, f"error_no_tabla_movs_{cuenta_info.get('numero', 'unknown')}.png"))
                                        # Salir de la extracción de movimientos para esta cuenta si no hay tabla.
                                        # El bloque finally se encargará de volver a Home.
                                        return [] # Retorna lista vacía, no se pudieron extraer.

                                if tabla_selector:
                                    MAX_PAGES_MOVEMENTS = 10 
                                    for page_num in range(MAX_PAGES_MOVEMENTS):
                                        print(f"            [📄] Procesando página {page_num + 1}/{MAX_PAGES_MOVEMENTS} de movimientos...")
                                        try:
                                            # Esperar a que las filas estén cargadas en la tabla/lista
                                            await page.wait_for_selector(f"{tabla_selector} tr, {tabla_selector} > div", timeout=10000) # Adaptado para tr o div hijos

                                            # Usar el script JS robusto proporcionado anteriormente para extraer filas
                                            # Definir regex como raw strings en Python para evitar SyntaxWarnings
                                            python_fecha_regex_str = r"^\d{2}(\/|-)\d{2}(\/|-)\d{4}$"
                                            python_monto_regex_str = r"\$?\s*([+-]?\d{1,3}(?:[.,]\d{3})*(?:[,.]\d{1,2})?)" # Nota: no global, para .match o .exec
                                            python_whitespace_pattern = r"\\s+" # Para new RegExp('\\s+', 'g') en JS
                                            python_whitespace_flags = r"g"

                                            js_script_rows = f"""
                                            () => {{
                                                const selector = `{tabla_selector}`.trim();
                                                const tableNode = document.querySelector(selector);
                                                if (!tableNode) {{
                                                    console.error(`JS: No se encontró tabla con selector: '${{selector}}'`);
                                                    return [];
                                                }}

                                                let row_elements;
                                                const tbody = tableNode.querySelector('tbody');
                                                if (tbody) {{
                                                    row_elements = Array.from(tbody.querySelectorAll('tr'));
                                                }} else {{
                                                    row_elements = Array.from(tableNode.querySelectorAll('tr[role="row"], tr:not(:has(th))'));
                                                    if (row_elements.length === 0 && tableNode.children.length > 0 &&
                                                        !tableNode.querySelector('thead') && !tableNode.querySelector('tfoot') &&
                                                        Array.from(tableNode.children).every(child => child.tagName !== 'TR' && child.tagName !== 'THEAD' && child.tagName !== 'TFOOT' )) {{
                                                        row_elements = Array.from(tableNode.children);
                                                    }}
                                                }}

                                                if (!row_elements || row_elements.length === 0) {{
                                                    console.warn(`JS: No se encontraron filas en selector: '${{selector}}'`);
                                                    return [];
                                                }}

                                                return row_elements.map(row => {{
                                                    const cells = Array.from(row.querySelectorAll('td, th[role="gridcell"], div[role="gridcell"]'));
                                                    let childDivsAsCells = [];
                                                    if (cells.length === 0 && row.children.length > 0 && (row.tagName === 'DIV' || row.tagName === 'LI')) {{
                                                        childDivsAsCells = Array.from(row.children);
                                                    }}
                                                    const effectiveCells = cells.length > 0 ? cells : childDivsAsCells;

                                                    let fecha = ''; let descripcion = ''; let monto_str = ''; let esAbono = false;
                                                    const fechaRegex = /{python_fecha_regex_str}/;
                                                    const montoRegex = /{python_monto_regex_str}/;
                                                    const whitespaceRegex = new RegExp('{python_whitespace_pattern}', '{python_whitespace_flags}');
                                                    
                                                    if (effectiveCells.length < 2 && row.textContent) {{
                                                        const fullText = row.textContent.replace(whitespaceRegex, ' ').trim();
                                                        const fechaMatch = fullText.match(fechaRegex);
                                                        if (fechaMatch) fecha = fechaMatch[0];
                                                        const montoMatch = fullText.match(montoRegex);
                                                        if (montoMatch) {{
                                                            monto_str = montoMatch[1] || montoMatch[0];
                                                            monto_str = monto_str.replace(/\\s/g, '');
                                                            if (fullText.includes('+') || (montoMatch[0] && montoMatch[0].includes('+'))) esAbono = true;
                                                            if (row.querySelector('.green_text, [style*="color: green"], [style*="rgb(17, 122, 101)"]') || row.classList.contains('green_row')) esAbono = true;
                                                        }}
                                                        let tempDesc = fullText;
                                                        if (fecha) tempDesc = tempDesc.replace(fecha, '');
                                                        if (montoMatch && montoMatch[0]) tempDesc = tempDesc.replace(montoMatch[0], '');
                                                        descripcion = tempDesc.trim();
                                                        if (descripcion.startsWith('-')) descripcion = descripcion.substring(1).trim();
                                                        if (descripcion.length < 2 && fullText.length > ( (fecha?fecha.length:0) + (monto_str?monto_str.length:0) + 5 ) ) {{
                                                             descripcion = "Descripción no parseada";
                                                        }}
                                                    }} else {{
                                                        let descParts = [];
                                                        effectiveCells.forEach((cell) => {{
                                                            const text = cell.textContent.trim();
                                                            if (fechaRegex.test(text) && !fecha) {{
                                                                fecha = text;
                                                            }} else if (montoRegex.test(text) && !monto_str) {{
                                                                const montoMatchText = montoRegex.exec(text);
                                                                monto_str = montoMatchText[1] || montoMatchText[0];
                                                                monto_str = monto_str.replace(/\\s/g, '');
                                                                if (cell.querySelector('.green_text, [style*="color: green"], [style*="rgb(17, 122, 101)"]') || row.classList.contains('green_row') || text.includes('+')) {{
                                                                    esAbono = true;
                                                                }}
                                                            }} else if (text) {{
                                                                descParts.push(text);
                                                            }}
                                                        }});
                                                        descripcion = descParts.filter(p => p !== fecha && p !== monto_str && (monto_str?!p.includes(monto_str.replace(/[$.]/g,'')) : true) ).join(' - ');
                                                    }}
                                                    if (!descripcion && (fecha || monto_str)) descripcion = "No disponible";
                                                    if (!fecha || !descripcion || !monto_str) return null;
                                                    return {{ fecha, descripcion, monto: monto_str, esAbono }};
                                                }}).filter(r => r !== null && r.fecha && r.monto);
                                            }}
                                            """
                                            current_page_rows_data = await page.evaluate(js_script_rows)

                                            if not current_page_rows_data:
                                                print("              No se extrajeron más movimientos en esta página. Fin de paginación para esta cuenta.")
                                                break # Salir del bucle de paginación de movimientos

                                            for row_data in current_page_rows_data:
                                                try:
                                                    monto_str_cleaned = row_data['monto'].replace('$', '').replace('.', '').replace(',', '.').strip()
                                                    if not monto_str_cleaned: continue
                                                    
                                                    monto_val = float(monto_str_cleaned.replace('+', '').replace('-', ''))
                                                    if row_data['esAbono'] or '+' in row_data['monto']:
                                                        pass # Es abono, monto_val es positivo
                                                    elif '-' in row_data['monto']:
                                                        monto_val = -monto_val
                                                    else: # Asumir cargo si no hay indicio de abono
                                                        monto_val = -monto_val
                                                    
                                                    mov_key = f"{row_data['fecha']}_{row_data['descripcion']}_{monto_val}"
                                                    if not any(m.get('key') == mov_key for m in movimientos_extraidos_list):
                                                        movimientos_extraidos_list.append({
                                                            'key': mov_key, 'fecha': row_data['fecha'],
                                                            'descripcion': row_data['descripcion'], 'monto': monto_val
                                                        })
                                                        print(f"                [+] Movimiento: {row_data['fecha']} | {row_data['descripcion']} | {monto_val}")
                                                except Exception as e_row_proc:
                                                    print(f"                Error procesando fila de movimiento: {e_row_proc}. Data: {row_data}")
                                                    continue
                                            
                                            # Intentar paginar a la siguiente
                                            next_mov_page_button = page.locator("button[aria-label*='Página siguiente']:not([disabled])")
                                            if await next_mov_page_button.count() > 0:
                                                print("              Avanzando a la siguiente página de movimientos...")
                                                await next_mov_page_button.click()
                                                await page.wait_for_timeout(3000) # Espera carga
                                            else:
                                                print("              No hay más páginas de movimientos (botón 'siguiente' no encontrado o deshabilitado).")
                                                break # Salir del bucle de paginación
                                        except Exception as e_page_mov_proc:
                                            print(f"            Error procesando página {page_num + 1} de movimientos: {e_page_mov_proc}")
                                            # await page.screenshot(path=os.path.join(self.config.debug_dir, f"error_proc_page_movs_{cuenta_info.get('numero', 'unknown')}_pg{page_num+1}.png"))
                                            break # Salir del bucle de paginación si hay error en una página

                            # --- FIN EXTRACCIÓN DE MOVIMIENTOS EN PÁGINA DE DETALLE ---
                            except Exception as e_mov_detail_page:
                                print(f"      Error mayor en la página de detalle de movimientos o durante su extracción: {e_mov_detail_page}")
                                # await page.screenshot(path=os.path.join(self.config.debug_dir, f"error_mov_detail_page_{cuenta_info.get('numero', 'unknown')}.png"))
                            
                            # Una vez procesada la tarjeta objetivo, salimos del bucle de tarjetas y del carrusel
                            if found_target_card_and_processed:
                                break # Salir del bucle de tarjetas visibles 'for card_element in visible_cards:'
                        
                    finally: # Este finally es para la lógica de CADA tarjeta procesada o intentada
                        if found_target_card_and_processed: # Solo si es la tarjeta objetivo y se intentó procesar
                            print(f"    [🏠] Fin de procesamiento para tarjeta objetivo. Asegurando retorno a Home...")
                            try:
                                MAX_HOME_RETURN_ATTEMPTS = 3 
                                home_returned_successfully = False
                                for attempt_home in range(MAX_HOME_RETURN_ATTEMPTS):
                                    print(f"      Intento {attempt_home + 1}/{MAX_HOME_RETURN_ATTEMPTS} de retornar y verificar Home.")
                                    
                                    action_taken_this_attempt = False
                                    try:
                                        side_menu_inicio_button = page.locator("app-side-menu li#A0000-inicio button[aria-label='Inicio']")
                                        if await side_menu_inicio_button.count() > 0:
                                            print("      Intentando hacer clic en 'Inicio' del menú lateral...")
                                            
                                            close_main_menu_btn = page.locator("app-side-menu button#closeMainSideMenu:visible")
                                            if await close_main_menu_btn.count() > 0:
                                                is_menu_overlay_visible = await page.locator("app-side-menu div.overlay-menu:visible").count() > 0
                                                if is_menu_overlay_visible:
                                                    print("       Overlay de menú lateral detectado. Intentando cerrar menú...")
                                                    await close_main_menu_btn.click()
                                                    await page.wait_for_timeout(1500)

                                            side_menu_inicio_button = page.locator("app-side-menu li#A0000-inicio button[aria-label='Inicio']") # Re-locate
                                            if await side_menu_inicio_button.is_visible(timeout=7000): # Aumentar timeout para visibilidad
                                                await side_menu_inicio_button.click(timeout=10000)
                                                print("      Clic en 'Inicio' del menú lateral realizado. Esperando carga inicial de página...")
                                                await page.wait_for_load_state("domcontentloaded", timeout=30000)
                                                await page.wait_for_timeout(3000) 
                                                action_taken_this_attempt = True
                                            else:
                                                print("      Botón 'Inicio' del menú lateral encontrado en DOM pero no visible/interactuable. Se saltará el clic.")
                                        else:
                                            print("      Botón 'Inicio' del menú lateral no encontrado en el DOM.")

                                        if action_taken_this_attempt:
                                            current_home_url = page.url # Guardar la URL a la que nos llevó el clic
                                            print(f"      URL actual después de clic en Inicio: {current_home_url}. Recargando página...")
                                            await page.reload(timeout=35000, wait_until="domcontentloaded") # Timeout más largo para reload
                                            print("      Página recargada. Esperando renderizado post-DOM-load...")
                                            await page.wait_for_timeout(10000) # Espera muy generosa
                                        else:
                                            # Si no se pudo hacer clic en el menú, este intento fallará la verificación y pasará al siguiente,
                                            # o fallará definitivamente si es el último.
                                            print("      No se pudo realizar la acción de clic en menú. La verificación de Home probablemente fallará para este intento.")


                                    except Exception as e_click_or_reload:
                                        print(f"      Error durante clic en menú o recarga: {e_click_or_reload}")
                                        # Dejar que la verificación falle para pasar al siguiente intento

                                    # Cerrar modales/sidebars que puedan haber reaparecido
                                    print("      Cerrando posibles modales/sidebars post-navegación/recarga...")
                                    await self.cerrar_sidebar(page) 
                                    await self.cerrar_modal_infobar(page) 
                                    await page.wait_for_timeout(2000) 

                                    # Verificar que el carrusel (o un contenedor principal) esté visible
                                    try:
                                        print("      Verificando elementos clave de Home...")
                                        await page.wait_for_selector("app-carrusel-productos-wrapper", timeout=80000) # Aumentar timeout
                                        print("    ✔️ Retorno a Home y carga del carrusel verificados.")
                                        home_returned_successfully = True
                                        break 
                                    except Exception as e_verify_home:
                                        print(f"      Fallo en intento {attempt_home + 1} de verificar elementos de Home: {e_verify_home}")
                                        current_url_on_fail = page.url
                                        print(f"        URL al momento del fallo de verificación: {current_url_on_fail}")
                                        if "chrome-error://" in current_url_on_fail:
                                            print("        Detectada página de error de Chrome. Es probable que haya un problema de red persistente.")
                                            # Si es un error de chrome, forzar un goto a la URL base para intentar recuperarse en el siguiente intento
                                            if attempt_home < MAX_HOME_RETURN_ATTEMPTS - 1:
                                                print(f"        Intentando navegar a la URL base del banco para el próximo intento...")
                                                try:
                                                    await page.goto("https://www.bancoestado.cl/imagenes/home/default.asp", timeout=30000, wait_until="domcontentloaded") # URL base conocida
                                                    await page.wait_for_timeout(5000)
                                                except Exception as e_goto_base:
                                                    print(f"          Error al intentar ir a la URL base: {e_goto_base}")

                                        if attempt_home < MAX_HOME_RETURN_ATTEMPTS - 1:
                                            print("        Reintentando volver a Home en unos segundos...")
                                            await page.wait_for_timeout(8000) # Pausa más larga antes de reintentar
                                        else:
                                            print("      Se agotaron los intentos para retornar y verificar Home.")
                                            raise 
                                
                                if not home_returned_successfully:
                                     raise Exception("No se pudo retornar y verificar Home después de múltiples intentos (estado inesperado).")

                            except Exception as e_return_home:
                                print(f"    ⚠️ Error CRÍTICO intentando retornar/verificar Home después de procesar tarjeta: {e_return_home}")
                                raise Exception(f"Fallo crítico al retornar a Home: {e_return_home}")
                
                if found_target_card_and_processed:
                    print(f"[✅] Tarjeta objetivo procesada. Saliendo del bucle del carrusel.")
                    break # Salir del bucle del carrusel 'for slide_attempt in range(MAX_CAROUSEL_SLIDES):'

                # Intentar avanzar al siguiente slide del carrusel si no hemos procesado la tarjeta aún
                print(f"  Intentando avanzar al siguiente slide del carrusel (desde slide {slide_attempt + 1})...")
                next_carousel_btn = page.locator("button[aria-label='Siguiente']:not([disabled])") # Botón del carrusel
                if await next_carousel_btn.count() > 0:
                    await next_carousel_btn.click()
                    print(f"  ➡️ Click en 'Siguiente' del carrusel. Esperando {2.5}s...")
                    await page.wait_for_timeout(2500)
                else:
                    print("  No hay botón 'Siguiente' en el carrusel o está deshabilitado. Asumiendo fin del carrusel.")
                    break # Salir del bucle del carrusel

            # Fin del bucle del carrusel
            if not found_target_card_and_processed:
                print(f"⚠️ No se encontró o no se procesó la tarjeta para '{cuenta_info.get('nombre')}' después de {MAX_CAROUSEL_SLIDES} intentos de carrusel.")
            
            # Limpiar keys de los movimientos antes de retornarlos
            for m in movimientos_extraidos_list: m.pop('key', None)
            
            if movimientos_extraidos_list:
                print(f"💰 Total final de movimientos extraídos para '{cuenta_info.get('nombre')}': {len(movimientos_extraidos_list)}")
            else:
                print(f"ℹ️ No se extrajeron movimientos para '{cuenta_info.get('nombre')}' en esta ejecución.")

            return movimientos_extraidos_list

        except Exception as e_main_extract_mov:
            print(f"❌❌❌ Error MAYOR Y GENERAL en extract_movimientos_cuenta para '{cuenta_info.get('nombre')}': {e_main_extract_mov}")
            # ts_error_main = datetime.now().strftime("%Y%m%d_%H%M%S")
            # try:
            #     await page.screenshot(path=os.path.join(self.config.debug_dir, f"error_FATAL_extract_movs_{cuenta_info.get('numero', 'unknown')}_{ts_error_main}.png"))
            # except Exception as e_ss:
            #     print(f"  No se pudo tomar screenshot del error fatal: {e_ss}")
            return [] # Retornar lista vacía en caso de error fatal para no romper el flujo principal

    async def login_banco_estado(self, page, credentials):
        print("🔐 Iniciando sesión...")
        try:
            await page.goto("https://www.bancoestado.cl", timeout=20000)
            await self.simular_comportamiento_humano(page)
            # No esperar 'main' directamente, sino un elemento más fiable del home
            await page.wait_for_selector("a[href*='login'] span:text('Banca en Línea')", timeout=15000) # Esperar el botón de login
            await page.click("a[href*='login']") # Clic en el enlace que contiene "Banca en Línea"
            await page.wait_for_selector("#rut", timeout=10000)
            await page.click("#rut")
            await page.evaluate("document.getElementById('rut').removeAttribute('readonly')")
            await self.type_like_human(page, "#rut", credentials.rut)
            await page.click("#pass")
            await page.evaluate("document.getElementById('pass').removeAttribute('readonly')")
            await self.type_like_human(page, "#pass", credentials.password)
            await self.simular_comportamiento_humano(page)
            await page.keyboard.press("Tab")
            await self.espera_aleatoria(page)
            await page.click("#btnLogin")
            # Revisar si aparece el modal de error visual
            modal_error = page.locator("text='ha ocurrido un error'")
            if await modal_error.count() > 0:
                print("⚠️ Modal de error detectado tras login")
                raise Exception("❌ Error visible en pantalla después de iniciar sesión")
            
            await page.wait_for_timeout(7000)
            content = await page.content()
            errores = ["clave incorrecta", "rut incorrecto", "ha ocurrido un error"]
            if any(e in content.lower() for e in errores):
                raise Exception("❌ Credenciales inválidas o error general al iniciar sesión")

            return content
        except Exception as e:
            raise Exception(f"Error durante el login: {str(e)}")

    def guardar_en_json(self, nombre_archivo: str, data: dict):
        path = os.path.join(self.config.results_dir, nombre_archivo)
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"💾 Resultado guardado localmente en {path}")