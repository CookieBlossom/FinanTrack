import json
import random
import redis
import os
from datetime import datetime
from playwright.async_api import async_playwright
from utils.redis_client import get_task, store_result
import re
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
                    # Configuración del navegador
                    browser = await p.chromium.launch(headless=False, slow_mo=300)
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
                    await page.wait_for_timeout(2000)
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
        base_time = random.randint(800, 1200)
        jitter = random.randint(-200, 200)
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
            await page.wait_for_timeout(1000)
            
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
            await page.type(selector, char, delay=random.randint(50, 150))
            if random.random() < 0.1:  # 10% de probabilidad de pausa
                await page.wait_for_timeout(random.randint(100, 300))

    async def simular_comportamiento_humano(self, page):
        # Movimientos aleatorios del mouse
        for _ in range(3):
            x = random.randint(100, 800)
            y = random.randint(100, 600)
            await page.mouse.move(x, y, steps=random.randint(5, 10))
            await page.wait_for_timeout(random.randint(100, 300))
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
            # Esperar a que el switch esté disponible
            await page.wait_for_selector("#showMonto", timeout=20000)
            # Intentar hacer click usando JavaScript
            await page.evaluate("""
                const switchElement = document.querySelector('#showMonto');
                if (switchElement) {
                    switchElement.click();
                }
            """)
            print("👁️ Intentando mostrar saldos...")
            await page.wait_for_timeout(5000)  # Aumentamos el tiempo de espera a 5 segundos
            # Verificar si los saldos se mostraron correctamente
            saldos_visibles = await page.locator("div[class*='__saldo'] div:not(:has-text('*********'))").count()
            if saldos_visibles > 0:
                print("✅ Saldos mostrados correctamente")
            else:
                print("⚠️ Los saldos no se mostraron, intentando nuevamente...")
                await page.evaluate("""
                    const switchElement = document.querySelector('#showMonto');
                    if (switchElement) {
                        switchElement.click();
                    }
                """)
                await page.wait_for_timeout(5000)
        except Exception as e:
            print(f"ℹ️ Info al intentar mostrar saldos: {e}")

    async def extract_cuentas(self, page):
        print("🔍 Extrayendo cuentas...")
        await self.cerrar_modal_infobar(page)
        # Esperar a que el carrusel esté presente
        await page.wait_for_selector("app-carrusel-productos-wrapper", timeout=20000)
        print("🔍 Encontramos el carrusel")
        # Intentar mostrar los saldos
        await self.mostrar_saldos(page)
        # Esperar a que las tarjetas estén visibles
        await page.wait_for_selector("app-card-producto:visible, app-card-ahorro:visible", timeout=10000)
        cuentas = []
        total_cuentas = 0
        # Función para extraer información de una tarjeta
        async def extraer_info_tarjeta(card):
            try:
                # Extraer nombre de la cuenta
                nombre_el = card.locator("div[class*='__nombre-cuenta']")
                await nombre_el.wait_for(timeout=3000)
                nombre = await nombre_el.text_content()
                nombre = (nombre or "(sin nombre)").strip()
                # Extraer número de cuenta
                numero_cuenta = ""
                try:
                    numero_el = card.locator("div[class*='__nombre-cuenta'] span")
                    if await numero_el.count() > 0:
                        numero_cuenta = await numero_el.text_content()
                except Exception as e:
                    print(f"⚠️ Error al extraer número de cuenta: {e}")

                # Extraer saldo
                saldo = ""
                try:
                    saldo_el = card.locator("div[class*='__saldo'] div")
                    if await saldo_el.count() > 0:
                        saldo = await saldo_el.text_content()
                        saldo = saldo.replace("$", "").strip()
                except Exception as e:
                    print(f"⚠️ Error al extraer saldo: {e}")

                return {
                    "nombre": nombre,
                    "numero": numero_cuenta,
                    "saldo": saldo
                }
            except Exception as e:
                print(f"⚠️ Error al extraer información de tarjeta: {e}")
                return None

        # Procesar todas las tarjetas visibles
        while True:
            # Obtener tarjetas visibles actuales
            cards = await page.locator("app-card-producto:visible, app-card-ahorro:visible").all()
            if not cards:
                break
            # Extraer información de cada tarjeta visible
            for card in cards:
                cuenta_info = await extraer_info_tarjeta(card)
                if cuenta_info:
                    # Verificar si la cuenta ya fue procesada
                    if not any(c["numero"] == cuenta_info["numero"] for c in cuentas):
                        cuentas.append(cuenta_info)
                        total_cuentas += 1
                        print(f"➡️ Cuenta #{total_cuentas}: {cuenta_info['nombre']} - {cuenta_info['numero']} - Saldo: {cuenta_info['saldo']}")
        
            # Intentar avanzar al siguiente grupo de tarjetas
            try:
                next_button = page.locator("button[aria-label='Siguiente']")
                if await next_button.count() > 0 and await next_button.is_visible():
                    await next_button.click()
                    await page.wait_for_timeout(1000)  # Esperar a que carguen las nuevas tarjetas
                else:
                    break  # No hay más tarjetas para ver
            except Exception:
                break  # Si hay error al avanzar, asumimos que no hay más tarjetas
        
        if not cuentas:
            raise Exception("No se pudo extraer ninguna cuenta")
        
        print(f"✅ Se extrajeron {len(cuentas)} cuentas exitosamente")
        return cuentas

    async def extract_ultimos_movimientos(self, page):
        print("🔍 Extrayendo últimos movimientos...")
        movimientos = []
        
        try:
            # Esperar a que aparezca la sección de últimos movimientos
            await page.wait_for_selector("app-ultimos-movimientos-home", timeout=15000)
            print("✅ Sección de últimos movimientos encontrada")
            
            # Esperar a que aparezca la lista de movimientos
            await page.wait_for_selector("div.list-movimiento", timeout=15000)
            print("✅ Lista de movimientos encontrada")
            
            # Obtener el contenedor de scroll
            scroll_container = page.locator("div.msd-container-scroll__content")
            
            # Función para extraer movimientos de la vista actual
            async def extraer_movimientos_vista():
                items = await page.locator("div.list-item-movimiento").all()
                for item in items:
                    try:
                        # Verificar si el item ya fue procesado
                        fecha = await item.locator("div.list-item-movimiento__fecha").text_content()
                        descripcion = await item.locator("div.list-item-movimiento__glosa").text_content()
                        monto_text = await item.locator("div.list-item-movimiento__monto span").last.text_content()
                        
                        # Crear una clave única para el movimiento
                        movimiento_key = f"{fecha}_{descripcion}_{monto_text}"
                        
                        # Si el movimiento ya existe, saltarlo
                        if any(m.get('key') == movimiento_key for m in movimientos):
                            continue
                        
                        # Extraer fecha
                        fecha = fecha.strip()
                        
                        # Extraer descripción
                        descripcion = descripcion.strip()
                        
                        # Extraer monto y tipo (cargo/abono)
                        monto_el = item.locator("div.list-item-movimiento__monto span")
                        monto_text = await monto_el.last.text_content()
                        
                        # Determinar si es cargo o abono basado en la clase green_text
                        tipo = "cargo"
                        if await item.locator("span.green_text").count() > 0:
                            tipo = "abono"
                            monto = monto_text.replace("+", "").replace("$", "").replace(".", "").strip()
                        else:
                            monto = monto_text.replace("-", "").replace("$", "").replace(".", "").strip()
                        
                        movimiento = {
                            "key": movimiento_key,
                            "fecha": fecha,
                            "descripcion": descripcion,
                            "monto": int(monto),
                            "tipo": tipo
                        }
                        
                        movimientos.append(movimiento)
                        print(f"✅ Movimiento extraído: {fecha} - {descripcion} - {monto}")
                        
                    except Exception as e:
                        print(f"❌ Error al extraer movimiento: {str(e)}")
                        continue
            
            # Extraer movimientos iniciales
            await extraer_movimientos_vista()
            
            # Realizar scroll hasta el final
            last_height = await scroll_container.evaluate("el => el.scrollHeight")
            while True:
                # Hacer scroll hacia abajo
                await scroll_container.evaluate("el => el.scrollTo(0, el.scrollHeight)")
                await page.wait_for_timeout(1000)  # Esperar a que cargue el contenido
                
                # Extraer movimientos de la nueva vista
                await extraer_movimientos_vista()
                
                # Obtener nueva altura
                new_height = await scroll_container.evaluate("el => el.scrollHeight")
                
                # Si la altura no cambió, hemos llegado al final
                if new_height == last_height:
                    break
                    
                last_height = new_height
            
            # Eliminar la clave temporal de los movimientos
            for movimiento in movimientos:
                movimiento.pop('key', None)
            
            print(f"✅ Se extrajeron {len(movimientos)} movimientos en total")
            return movimientos
            
        except Exception as e:
            print(f"❌ Error al extraer movimientos: {str(e)}")
            # Guardar screenshot para debug con timestamp
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            screenshot_path = os.path.join(self.config.debug_dir, f"ultimos_movimientos_{timestamp}.png")
            await page.screenshot(path=screenshot_path)
            print(f"📸 Screenshot guardado en: {screenshot_path}")
            return []

    async def extract_movimientos_cuenta(self, page, cuenta_info):
        print(f"\n🔍 Validando acceso a movimientos para: {cuenta_info['nombre']}")
        try:
            # 1. Verificar que estamos en la página principal (home)
            print("1️⃣ Verificando que estamos en la página principal (home)...")
            try:
                await page.wait_for_selector("app-carrusel-productos-wrapper", timeout=10000)
                print("✅ Estamos en la página principal")
            except Exception as e:
                print("❌ No estamos en la página principal")
                return None

            # 2. Cerrar cualquier sidebar o modal que pueda interferir
            print("2️⃣ Cerrando sidebars y modales...")
            await self.cerrar_sidebar(page)
            await self.cerrar_modal_infobar(page)

            # 3. Buscar todas las tarjetas visibles
            print("3️⃣ Buscando tarjetas en el carrusel...")
            movimientos = []
            found_card = False
            carrusel_position = 0
            
            while True:
                # Si no es la primera iteración y tenemos una posición guardada, avanzar en el carrusel
                if carrusel_position > 0:
                    print(f"🔄 Volviendo a la posición {carrusel_position} del carrusel...")
                    for _ in range(carrusel_position):
                        next_button = page.locator("button[aria-label='Siguiente']")
                        if await next_button.count() > 0 and await next_button.is_visible():
                            await next_button.click()
                            await page.wait_for_timeout(2000)
                        else:
                            print("⚠️ No se pudo volver a la posición anterior del carrusel")
                            break

                # Obtener tarjetas visibles actuales
                try:
                    await page.wait_for_selector("app-card-producto:visible, app-card-ahorro:visible", timeout=5000)
                    cards = await page.locator("app-card-producto:visible, app-card-ahorro:visible").all()
                    print(f"📍 Encontradas {len(cards)} tarjetas visibles en la posición {carrusel_position}")
                    
                    # Procesar cada tarjeta visible
                    for card in cards:
                        try:
                            # Extraer nombre de la cuenta
                            nombre_el = card.locator("div[class*='__nombre-cuenta']")
                            await nombre_el.wait_for(timeout=3000)
                            nombre = await nombre_el.text_content()
                            nombre = (nombre or "").strip()

                            # Extraer número de cuenta
                            numero_cuenta = ""
                            try:
                                numero_el = card.locator("div[class*='__nombre-cuenta'] span")
                                if await numero_el.count() > 0:
                                    numero_cuenta = await numero_el.text_content()
                                    numero_cuenta = numero_cuenta.strip()
                            except Exception as e:
                                print(f"⚠️ Error al extraer número de cuenta: {e}")

                            print(f"👉 Revisando tarjeta: {nombre} - {numero_cuenta}")

                            # Verificar si es la tarjeta que buscamos
                            if (numero_cuenta and numero_cuenta == cuenta_info['numero']) or \
                               (nombre and nombre == cuenta_info['nombre']):
                                found_card = True
                                print(f"✅ Tarjeta encontrada: {nombre}")

                                # 4. Buscar y hacer click en el botón de movimientos
                                print("4️⃣ Buscando botón de Saldos y movs...")
                                movimientos_btn = card.locator("button:has-text('Saldos y movs.')")
                                if await movimientos_btn.count() == 0:
                                    print("❌ No se encontró el botón de movimientos")
                                    continue

                                print("✅ Botón encontrado")
                                await movimientos_btn.click()
                                await page.wait_for_timeout(5000)

                                # 5. Verificar que estamos en la página de cartola
                                print("5️⃣ Verificando que estamos en la página de cartola...")
                                try:
                                    await page.wait_for_selector("app-movimiento-detalle", timeout=15000)
                                    print("✅ Estamos en la página de cartola")

                                    # 6. Extraer movimientos
                                    print("6️⃣ Extrayendo movimientos...")
                                    try:
                                        # Esperar a que la tabla de datos esté presente
                                        await page.wait_for_selector("app-listado-movimientos table", timeout=15000)
                                        print("✅ Tabla de movimientos encontrada")
                                        
                                        # Procesar todas las páginas de movimientos
                                        while True:
                                            try:
                                                # Esperar a que las filas estén visibles
                                                await page.wait_for_selector("app-listado-movimientos table tbody tr", timeout=10000)

                                                # Obtener todas las filas de la página actual usando JavaScript
                                                rows = await page.evaluate("""
                                                    () => {
                                                        const rows = Array.from(document.querySelectorAll('app-listado-movimientos table tbody tr'));
                                                        return rows.map(row => {
                                                            const cells = Array.from(row.querySelectorAll('td'));
                                                            if (!cells.length) return null;
                                                            
                                                            // Encontrar la celda de fecha (normalmente la primera o segunda)
                                                            const fechaCell = cells.find(cell => {
                                                                const text = cell.textContent.trim();
                                                                return /^\\d{2}\\/\\d{2}\\/\\d{4}$/.test(text);
                                                            });
                                                            
                                                            // Encontrar la celda de descripción (normalmente después de la fecha)
                                                            const descCell = cells.find(cell => {
                                                                const text = cell.textContent.trim();
                                                                return text && text.length > 5 && !/^\\d{2}\\/\\d{2}\\/\\d{4}$/.test(text) && !/\\$/.test(text);
                                                            });
                                                            
                                                            // Encontrar la celda de monto (normalmente contiene $ y números)
                                                            const montoCell = cells.find(cell => {
                                                                const text = cell.textContent.trim();
                                                                return /\\$/.test(text) && /\\d/.test(text);
                                                            });
                                                            
                                                            if (!fechaCell || !descCell || !montoCell) return null;
                                                            
                                                            const esAbono = montoCell.querySelector('.green_text') !== null || 
                                                                                  montoCell.querySelector('[style*="color: green"]') !== null ||
                                                                                  montoCell.querySelector('[style*="color:#00A300"]') !== null ||
                                                                                  montoCell.querySelector('[style*="color: rgb(17, 122, 101)"]') !== null ||
                                                                                  row.classList.contains('green_row');
                                                                                  
                                                            return {
                                                                fecha: fechaCell.textContent.trim(),
                                                                descripcion: descCell.textContent.trim(),
                                                                monto: montoCell.textContent.trim(),
                                                                esAbono: esAbono
                                                            };
                                                        }).filter(row => row !== null);
                                                    }
                                                """)
                                                
                                                if not rows:
                                                    print("⚠️ No se encontraron más movimientos")
                                                    break

                                                # Procesar cada movimiento
                                                for row in rows:
                                                    try:
                                                        monto = row['monto'].replace('$', '').replace('.', '').replace(' ', '')
                                                        # Si el monto está vacío, lo saltamos
                                                        if not monto:
                                                            print(f"⚠️ Monto vacío en movimiento: {row['fecha']} - {row['descripcion']}")
                                                            continue
                                                        # Primero determinar si es positivo o negativo basado en el signo explícito
                                                        es_negativo = '-' in monto
                                                        es_positivo = '+' in monto
                                                        # Limpiar el monto dejando solo dígitos
                                                        monto_limpio = ''.join(c for c in monto if c.isdigit())
                                                        
                                                        if not monto_limpio:
                                                            print(f"⚠️ Monto inválido en movimiento: {row['fecha']} - {row['descripcion']}")
                                                            continue
                                                        # Convertir a entero
                                                        monto_final = int(monto_limpio)
                                                        # Aplicar el signo según corresponda
                                                        if es_negativo or (not es_positivo and not row['esAbono']):
                                                            monto_final = -monto_final
                                                        # Crear una clave única para el movimiento
                                                        movimiento_key = f"{row['fecha']}_{row['descripcion']}_{monto_final}"
                                                        # Verificar si el movimiento ya existe
                                                        if not any(m.get('key') == movimiento_key for m in movimientos):
                                                            print(f"✅ Movimiento extraído: {row['fecha']} - {row['descripcion']} - {monto_final}")
                                                            
                                                            movimientos.append({
                                                                'key': movimiento_key,
                                                                'fecha': row['fecha'],
                                                                'descripcion': row['descripcion'],
                                                                'monto': monto_final
                                                            })
                                                        else:
                                                            print(f"⚠️ Movimiento duplicado ignorado: {row['fecha']} - {row['descripcion']}")
                                                        
                                                    except Exception as e:
                                                        print(f"⚠️ Error procesando movimiento: {str(e)}")
                                                        continue

                                                # Intentar avanzar a la siguiente página
                                                next_button = page.locator("button[aria-label='Página siguiente']")
                                                if await next_button.count() > 0 and await next_button.is_visible() and not await next_button.is_disabled():
                                                    print("➡️ Avanzando a la siguiente página de movimientos...")
                                                    await next_button.click()
                                                    await page.wait_for_timeout(2000)
                                                else:
                                                    print("⚠️ No hay más páginas de movimientos")
                                                    break

                                            except Exception as e:
                                                print(f"❌ Error al procesar página: {e}")
                                                break
                                        # Eliminar las claves temporales de los movimientos
                                        for movimiento in movimientos:
                                            movimiento.pop('key', None)
                                        
                                        print(f"✅ Total de movimientos extraídos: {len(movimientos)}")
                                    except Exception as e:
                                        print(f"❌ Error al extraer movimientos: {e}")
                                        await page.screenshot(path=os.path.join(self.config.debug_dir, f"error_extraccion_movimientos_{cuenta_info['numero']}.png"))
                                        print(f"📸 Screenshot guardado para debug")

                                    # 7. Volver a la página principal
                                    print("7️⃣ Volviendo a la página principal...")
                                    await page.go_back()
                                    await page.wait_for_timeout(3000)

                                    # 8. Verificar que volvimos correctamente
                                    try:
                                        await page.wait_for_selector("app-carrusel-productos-wrapper", timeout=10000)
                                        print("✅ De vuelta en la página principal")
                                        break  # Salir del loop de tarjetas si encontramos la que buscábamos
                                    except Exception as e:
                                        print(f"❌ Error al volver a la página principal: {e}")
                                        # Intentar navegar directamente a home si el back falla
                                        await page.goto("https://www.bancoestado.cl/home", timeout=20000)
                                        await page.wait_for_timeout(5000)

                                except Exception as e:
                                    print(f"❌ No se pudo cargar la página de cartola: {e}")
                                    # Intentar volver a la página principal
                                    await page.goto("https://www.bancoestado.cl/home", timeout=20000)
                                    await page.wait_for_timeout(5000)

                        except Exception as e:
                            print(f"⚠️ Error al procesar tarjeta: {e}")
                            continue

                    if found_card:
                        break

                    # Intentar avanzar al siguiente grupo de tarjetas
                    try:
                        next_button = page.locator("button[aria-label='Siguiente']")
                        if await next_button.count() > 0 and await next_button.is_visible():
                            print("➡️ Avanzando al siguiente grupo de tarjetas...")
                            await next_button.click()
                            await page.wait_for_timeout(2000)  # Esperar a que carguen las nuevas tarjetas
                            carrusel_position += 1  # Incrementar la posición en el carrusel
                            print(f"📍 Nueva posición en el carrusel: {carrusel_position}")
                        else:
                            print("🔚 No hay más grupos de tarjetas")
                            break  # No hay más tarjetas para ver
                    except Exception as e:
                        print(f"⚠️ Error al intentar avanzar al siguiente grupo: {e}")
                        break

                except Exception as e:
                    print(f"⚠️ Error al buscar tarjetas visibles: {e}")
                    break

            # Guardar los movimientos en la cuenta
            if movimientos:
                print(f"✅ Se encontraron {len(movimientos)} movimientos para la cuenta {cuenta_info['nombre']}")
                return movimientos
            else:
                print(f"⚠️ No se encontraron movimientos para la cuenta {cuenta_info['nombre']}")
                return None

        except Exception as e:
            print(f"❌ Error general al validar la cuenta {cuenta_info['nombre']}: {e}")
            return None

    async def login_banco_estado(self, page, credentials):
        print("🔐 Iniciando sesión...")
        try:
            await page.goto("https://www.bancoestado.cl", timeout=20000)
            await self.simular_comportamiento_humano(page)
            await page.wait_for_selector("main", timeout=15000)
            await page.wait_for_selector("a[href*='login'] span:text('Banca en Línea')", timeout=10000)
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