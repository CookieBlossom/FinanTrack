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

class BancoEstadoSaldosScraper:
    """
    Scraper especializado en obtener únicamente los saldos de las tarjetas de BancoEstado
    """
    def __init__(self, config: Optional[ScraperConfig] = None):
        self.config = config or ScraperConfig()
        self.redis_client = redis.Redis(
            host=self.config.redis_host, 
            port=self.config.redis_port, 
            decode_responses=True
        )

    async def run(self):
        print("[🚀 Scraper BancoEstado Saldos iniciado. Esperando tareas...]")

        while True:
            task = get_task(self.redis_client, "scraper:saldos:task")
            if not task:
                continue
            try:
                payload = json.loads(task)

                # Validar que sea una tarea para este scraper
                if 'site' in payload and payload['site'] != 'banco_estado':
                    continue
                
                # Obtener credenciales del payload
                credentials = Credentials(
                    rut=payload.get("rut") or payload.get("username"),
                    password=payload.get("password")
                )
    
                if not credentials.rut or not credentials.password:
                    raise ValueError("Credenciales incompletas: Se requiere RUT/username y contraseña")

                print(f"\n📨 Nueva tarea de saldos recibida para RUT: {credentials.rut}")

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
                    await self.login_banco_estado(page, credentials)
                    print("🔓 Login exitoso")
                    
                    # 2. Cerrar sidebars y modales
                    await self.cerrar_sidebar(page)
                    await self.cerrar_modal_infobar(page)
                    
                    # 3. Extraer información de cuentas y mostrar saldos
                    print("🔍 Extrayendo información de cuentas y saldos...")
                    await self.mostrar_saldos(page)
                    await page.wait_for_timeout(1000)
                    cuentas = await self.extract_cuentas(page)
                    
                    # 4. Preparar resultado
                    result = {
                        "success": True,
                        "cuentas": cuentas,
                        "fecha_extraccion": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    }

                    # 5. Guardar resultados
                    store_result(self.redis_client, f"scraper:saldos:response:{credentials.rut}", result)
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                    self.guardar_en_json(f"saldos_{credentials.rut}_{timestamp}.json", result)
                    
                    await browser.close()
                    print("🧹 Navegador cerrado correctamente")

            except Exception as e:
                print(f"[❌ ERROR] {str(e)}")
                error_result = {
                    "success": False,
                    "message": str(e)
                }
                if 'credentials' in locals():
                    store_result(self.redis_client, f"scraper:saldos:response:{credentials.rut}", error_result)

    async def espera_aleatoria(self, page):
        base_time = random.randint(300, 500)
        jitter = random.randint(-100, 100)
        await page.wait_for_timeout(base_time + jitter)

    async def cerrar_modal_infobar(self, page):
        try:
            # Primero intentar cerrar usando JavaScript
            await page.evaluate("""
                const closeButtons = Array.from(document.querySelectorAll('button[aria-label*="Close"]'));
                for (const button of closeButtons) {
                    if (button.offsetParent !== null) {
                        button.click();
                    }
                }
            """)
            await page.wait_for_timeout(500)
            
            # Si aún existe el botón, intentar el método tradicional
            modal_btn = page.locator("button.evg-btn-dismissal[aria-label*='Close']")
            if await modal_btn.count() > 0:
                try:
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
            await page.type(selector, char, delay=random.randint(20, 60))
            if random.random() < 0.05:  # 5% de probabilidad de pausa
                await page.wait_for_timeout(random.randint(50, 120))

    async def simular_comportamiento_humano(self, page):
        # Movimientos aleatorios del mouse (solo uno en modo headless)
        for _ in range(1):
            x = random.randint(100, 800)
            y = random.randint(100, 600)
            await page.mouse.move(x, y, steps=random.randint(3, 5))
            await page.wait_for_timeout(random.randint(50, 120))
        
        # Scroll aleatorio
        await page.evaluate("""
            window.scrollTo({
                top: Math.random() * document.body.scrollHeight,
                behavior: 'smooth'
            });
        """)
        await page.wait_for_timeout(random.randint(300, 700))

    async def mostrar_saldos(self, page):
        try:
            # Intentar cerrar cualquier sidebar antes de interactuar
            await self.cerrar_sidebar(page)
            print("👁️ Intentando mostrar saldos...")
            
            # Método 1: Usando #showMonto
            try:
                await page.wait_for_selector("#showMonto", timeout=30000)
                await page.evaluate("""
                    const switchElement = document.querySelector('#showMonto');
                    if (switchElement) {
                        switchElement.click();
                    }
                """)
                await page.wait_for_timeout(3000)
            except Exception as e:
                print(f"ℹ️ Info al intentar método 1: {e}")
            
            # Método 2: Intentar con otros selectores comunes
            if not await self.verificar_saldos_visibles(page):
                try:
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
                                        await page.wait_for_timeout(2000)
                                        if await self.verificar_saldos_visibles(page):
                                            return
                        except Exception:
                            continue
                except Exception as e:
                    print(f"ℹ️ Info al intentar método 2: {e}")
            
            # Método 3: Buscar elementos con texto relevante
            if not await self.verificar_saldos_visibles(page):
                try:
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
                            
                            // Hacer clic en elementos relevantes
                            elementosRelevantes.forEach(el => {
                                try {
                                    el.click();
                                } catch (err) {}
                            });
                        }
                    """)
                    await page.wait_for_timeout(2000)
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
                () => {
                    // Buscar texto que parezca un saldo (formato monetario)
                    const saldoRegex = /\\$[\\d.,]+/;
                    const elementos = document.querySelectorAll('div, span');
                    for (const el of elementos) {
                        const texto = el.textContent || '';
                        if (saldoRegex.test(texto) && !texto.includes('*********')) {
                            return true;
                        }
                    }
                    return false;
                }
            """)
        except Exception:
            return False

    async def extraer_info_tarjeta(self, card):
        """
        Extrae información de una tarjeta (cuenta) de BancoEstado
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

                # Intento 2: Si no se encontró, buscar h3 con aria-hidden="true"
                if not nombre_obtenido:
                    nombre_el_aria_hidden = card.locator("h3[aria-hidden='true']")
                    if await nombre_el_aria_hidden.count() > 0:
                        nombre = await nombre_el_aria_hidden.first.text_content()
                        if nombre:
                            info["nombre"] = nombre.strip()
                            nombre_obtenido = True
                
                # Intento 3: Fallback
                if not nombre_obtenido:
                    nombre_el_not_sr = card.locator("h3:not(.sr_only)")
                    if await nombre_el_not_sr.count() > 0:
                        nombre = await nombre_el_not_sr.first.text_content()
                        if nombre:
                            info["nombre"] = nombre.strip()
                            nombre_obtenido = True

            except Exception as e:
                print(f"⚠️ Error al extraer nombre con selectores h3: {e}")
            
            # Si no encontramos el nombre con los métodos anteriores, intentar con selectores alternativos
            if "nombre" not in info or not info.get("nombre"):
                try:
                    nombre_obtenido_alt = False
                    # Intento alternativo 1
                    alt_nombre_el_visible_not_sr = card.locator(".m-card-global__header--title h3:not(.sr_only):visible")
                    if await alt_nombre_el_visible_not_sr.count() > 0:
                        nombre_alt = await alt_nombre_el_visible_not_sr.first.text_content()
                        if nombre_alt:
                            info["nombre"] = nombre_alt.strip()
                            nombre_obtenido_alt = True
                    
                    # Intento alternativo 2
                    if not nombre_obtenido_alt:
                        alt_nombre_el_aria_hidden = card.locator(".m-card-global__header--title h3[aria-hidden='true']")
                        if await alt_nombre_el_aria_hidden.count() > 0:
                            nombre_alt = await alt_nombre_el_aria_hidden.first.text_content()
                            if nombre_alt:
                                info["nombre"] = nombre_alt.strip()
                                nombre_obtenido_alt = True

                    # Intento alternativo 3
                    if not nombre_obtenido_alt:
                        alt_nombre_el_not_sr = card.locator(".m-card-global__header--title h3:not(.sr_only)")
                        if await alt_nombre_el_not_sr.count() > 0:
                            nombre_alt = await alt_nombre_el_not_sr.first.text_content()
                            if nombre_alt:
                                info["nombre"] = nombre_alt.strip()
                                
                except Exception as e_alt:
                    print(f"⚠️ Error al extraer nombre con selector alternativo: {e_alt}")
            
            # Extraer del HTML como último recurso
            if "nombre" not in info or not info.get("nombre"):
                try:
                    html = await card.evaluate("el => el.innerHTML")
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
                # Buscar número en título
                numero_el = card.locator(".m-card-global__header--title p")
                if await numero_el.count() > 0:
                    numero = await numero_el.text_content()
                    info["numero"] = numero.strip()
                else:
                    # Intentar otros selectores
                    alt_numero_selector = "p[aria-hidden='true'][role='text']"
                    alt_numero = card.locator(alt_numero_selector)
                    if await alt_numero.count() > 0:
                        info["numero"] = (await alt_numero.text_content() or "").strip()
                    else:
                        # Extraer de atributos
                        info["numero"] = await card.evaluate("""
                            el => {
                                // Buscar en atributos aria-label
                                const ariaLabels = Array.from(el.querySelectorAll('[aria-label]'));
                                for (const element of ariaLabels) {
                                    const label = element.getAttribute('aria-label');
                                    const match = label && label.match(/\\d{8,}/);
                                    if (match) return match[0];
                                }
                                // Buscar cualquier secuencia numérica
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
                # Buscar en área de saldo/monto
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
                
                # Si no se encontró, intentar con JavaScript
                if "saldo" not in info or not info["saldo"]:
                    info["saldo"] = await card.evaluate("""
                        el => {
                            // Buscar formato de monto
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
            
            # Verificar información mínima
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
        
        # Esperar a que el carrusel esté presente
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
                
        # Cerrar cualquier sidebar o modal
        await self.cerrar_sidebar(page)
        
        # Mostrar los saldos
        await self.mostrar_saldos(page)
        
        # Esperar a que las tarjetas estén visibles
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
            print("⚠️ No se encontraron tarjetas con ningún selector")
        
        cuentas = []
        total_cuentas = 0
        
        # Procesar todas las tarjetas visibles
        for selector in selectores_tarjetas:
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
                        await page.wait_for_timeout(2000)
                    else:
                        break  # No hay más tarjetas
                except Exception as e:
                    print(f"ℹ️ Info al avanzar: {e}")
                    break
            except Exception as e:
                print(f"ℹ️ Info con selector {selector}: {e}")
                continue
        
        # Si no encontramos cuentas, intentar extracción directa del HTML
        if not cuentas:
            print("⚠️ Intentando extracción directa del HTML...")
            try:
                # Evaluar JavaScript para extraer información de tarjetas
                raw_cuentas = await page.evaluate("""
                    () => {
                        try {
                            // Buscar todas las tarjetas o elementos que podrían ser tarjetas
                            const tarjetas = Array.from(document.querySelectorAll('div[class*="card"], div[class*="producto"], div[class*="cuenta"]'));
                            return tarjetas.map(tarjeta => {
                                const textContent = tarjeta.textContent || '';
                                const textoCompleto = textContent.replace(/\\s+/g, ' ').trim();
                                // Extraer saldo usando expresiones regulares
                                const saldoMatch = textoCompleto.match(/\\$[\\d.,]+/);
                                const saldo = saldoMatch ? saldoMatch[0] : '';
                                
                                // Buscar nombre
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
                                
                                // Extraer número de cuenta
                                let numero = '';
                                const numeroMatch = textoCompleto.match(/\\b\\d{8,}\\b/);
                                if (numeroMatch) {
                                    numero = numeroMatch[0];
                                }
                                
                                return {
                                    nombre: nombre || 'Cuenta sin nombre',
                                    numero: numero,
                                    saldo: saldo
                                };
                            }).filter(cuenta => cuenta.nombre !== 'Cuenta sin nombre' || cuenta.saldo || cuenta.numero);
                        } catch (e) {
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
        
        # Si aún no encontramos cuentas, fallar
        if not cuentas:
            raise Exception("No se pudo extraer ninguna cuenta")
        
        print(f"✅ Se extrajeron {len(cuentas)} cuentas exitosamente")
        return cuentas

    async def login_banco_estado(self, page, credentials):
        print("🔐 Iniciando sesión...")
        try:
            await page.goto("https://www.bancoestado.cl", timeout=20000)
            await self.simular_comportamiento_humano(page)
            # Esperar el botón de login
            await page.wait_for_selector("a[href*='login'] span:text('Banca en Línea')", timeout=15000)
            await page.click("a[href*='login']")
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
            
            # Revisar si aparece el modal de error
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

# Punto de entrada si se ejecuta el scraper directamente
if __name__ == "__main__":
    import asyncio
    scraper = BancoEstadoSaldosScraper()
    asyncio.run(scraper.run()) 