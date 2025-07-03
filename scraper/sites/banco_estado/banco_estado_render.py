#!/usr/bin/env python3
"""
BancoEstado Scraper - Versión Render
Optimizado para hosting en Render con geolocalización fija y evasión específica
Solo implementa login para pruebas iniciales
"""

import json
import random
import os
import re
import sys
import asyncio
from datetime import datetime
from playwright.async_api import async_playwright
from dataclasses import dataclass
from typing import Optional, Dict, Any

@dataclass
class Credentials:
    rut: str
    password: str

class BancoEstadoRenderScraper:
    def __init__(self):
        # Configuración específica para Render
        self.geolocation = {
            "latitude": -33.4489,  # Santiago, Chile
            "longitude": -70.6693
        }
        self.user_data_dir = os.path.join(os.path.dirname(__file__), 'user_data_render')
        os.makedirs(self.user_data_dir, exist_ok=True)

    async def espera_aleatoria(self, page):
        """Espera aleatoria optimizada para Render"""
        base_time = random.randint(80, 200)  # Más rápido para Render
        jitter = random.randint(-15, 15)
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
            await page.wait_for_timeout(300)
            
            modal_btn = page.locator("button.evg-btn-dismissal[aria-label*='Close']")
            if await modal_btn.count() > 0:
                try:
                    await modal_btn.scroll_into_view_if_needed()
                    await page.wait_for_timeout(300)
                    await modal_btn.click(timeout=3000)
                    print("🔕 Modal de infobar cerrado")
                except Exception:
                    print("⚠️ No se pudo cerrar el modal de infobar")
            else:
                print("✅ No apareció el modal de infobar")
        except Exception as e:
            print(f"ℹ️ Info al intentar cerrar el modal: {e}")

    async def cerrar_sidebar(self, page):
        """Cierra sidebars emergentes"""
        try:
            sidebar_ids = ["holidayid", "afpid", "promoid", "infoid"]
            for sidebar_id in sidebar_ids:
                try:
                    sidebar = page.locator(f"#{sidebar_id} button[aria-label='Cerrar']")
                    if await sidebar.count() > 0 and await sidebar.is_visible():
                        await sidebar.click()
                        print(f"🔕 Sidebar {sidebar_id} cerrado")
                        await page.wait_for_timeout(500)
                        return True
                except Exception:
                    continue
            
            try:
                sidebar_class = page.locator(".sidebar-container button[aria-label='Cerrar'], .modal-container button[aria-label='Cerrar']")
                if await sidebar_class.count() > 0 and await sidebar_class.is_visible():
                    await sidebar_class.click()
                    print("🔕 Sidebar genérico cerrado")
                    await page.wait_for_timeout(500)
                    return True
            except Exception:
                pass
            
            print("✅ No hay sidebars para cerrar")
            return False
        except Exception as e:
            print(f"ℹ️ Info: {str(e)}")
            return False

    async def type_like_human(self, page, selector, text, delay=None):
        """Simula escritura humana optimizada para Render"""
        try:
            element = await page.wait_for_selector(selector, state="visible")
            await element.click()
            await element.fill("")
            await page.wait_for_timeout(random.randint(80, 150))
            
            if delay is None:
                if "pass" in selector.lower():
                    base_delay = random.randint(120, 200)  # Más lento para contraseñas
                else:
                    base_delay = random.randint(80, 150)
            else:
                base_delay = delay
            
            for i, char in enumerate(text):
                char_delay = base_delay
                
                if i > 0:
                    prev_char = text[i-1]
                    if prev_char in ['.', ' ', '-']:
                        char_delay *= 1.4
                    elif prev_char.isdigit() != char.isdigit():
                        char_delay *= 1.2
                    elif char == prev_char:
                        char_delay *= 0.8
                
                char_delay *= random.uniform(0.8, 1.2)
                
                # Simular error de escritura ocasional (menos frecuente en Render)
                if random.random() < 0.002:
                    wrong_char = random.choice('qwertyuiopasdfghjklzxcvbnm')
                    await element.type(wrong_char, delay=char_delay)
                    await page.wait_for_timeout(random.randint(200, 400))
                    await page.keyboard.press('Backspace')
                    await page.wait_for_timeout(random.randint(100, 200))
                
                await element.type(char, delay=char_delay)
                
                if random.random() < 0.01:
                    await page.wait_for_timeout(random.randint(200, 500))
            
            await page.wait_for_timeout(random.randint(150, 300))
            
        except Exception as e:
            print(f"❌ Error en type_like_human: {e}")
            await page.fill(selector, text)

    async def simular_comportamiento_humano(self, page):
        """Simula comportamiento humano optimizado para Render"""
        # Movimientos de mouse más simples para Render
        for _ in range(random.randint(1, 2)):
            x = random.randint(100, 800)
            y = random.randint(100, 600)
            await page.mouse.move(x, y, steps=random.randint(2, 4))
            await page.wait_for_timeout(random.randint(30, 100))
        
        # Scroll aleatorio más simple
        await page.evaluate("""
            window.scrollTo({
                top: Math.random() * document.body.scrollHeight * 0.2,
                behavior: 'smooth'
            });
        """)
        await page.wait_for_timeout(random.randint(200, 500))

    async def login_banco_estado(self, page, credentials: Credentials):
        """Inicia sesión en BancoEstado optimizado para Render"""
        try:
            print("🔑 Iniciando proceso de login en Render...")
            
            # Ir a la página de inicio
            print("🌐 Navegando a la página principal...")
            await page.goto('https://www.bancoestado.cl/', timeout=60000)
            await self.espera_aleatoria(page)
            
            # Cerrar modales o sidebars si aparecen
            await self.cerrar_modal_infobar(page) 
            await self.cerrar_sidebar(page)
            
            # PASO 1: Click en "Banca en Línea"
            print("🔍 Buscando botón 'Banca en Línea'...")
            try:
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
                            print(f"✅ Botón 'Banca en Línea' encontrado con selector: {selector}")
                            break
                    except Exception:
                        continue
                
                if not banca_button:
                    raise Exception("No se pudo encontrar el botón 'Banca en Línea'")
                
                # Simular comportamiento humano antes del click
                await banca_button.hover()
                await page.wait_for_timeout(random.randint(150, 300))
                await banca_button.click()
                print("✅ Click en 'Banca en Línea' realizado")
                
            except Exception as e:
                print(f"❌ Error al hacer click en 'Banca en Línea': {str(e)}")
                raise
            
            # Esperar a que cargue la página de login
            await page.wait_for_load_state("networkidle", timeout=30000)
            await page.wait_for_timeout(2000)
                                
            # Esperar y preparar campo de RUT
            await page.wait_for_selector("#rut", timeout=10000)
            await page.click("#rut")
            await page.evaluate("document.getElementById('rut').removeAttribute('readonly')")
            
            # Ingresar RUT simulando escritura humana
            print("📝 Ingresando RUT...")
            rut = credentials.rut.replace(".", "").replace("-", "").strip().lower()
            await self.type_like_human(page, "#rut", rut, delay=150)
            
            # Preparar e ingresar contraseña
            print("🔒 Ingresando contraseña...")
            await page.click("#pass")
            await page.evaluate("document.getElementById('pass').removeAttribute('readonly')")
            await self.type_like_human(page, "#pass", credentials.password, delay=130)
            
            # Simular comportamiento humano antes de enviar
            await self.simular_comportamiento_humano(page)
            await self.espera_aleatoria(page)
            
            # PASO 2: Click en botón "Ingresar"
            print("🔄 Iniciando proceso de login...")
            try:
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
                            print(f"✅ Botón 'Ingresar' encontrado con selector: {selector}")
                            break
                    except Exception:
                        continue
                
                if not login_button:
                    raise Exception("No se pudo encontrar el botón 'Ingresar'")
                
                await login_button.wait_for_element_state("enabled")
                await login_button.hover()
                await page.wait_for_timeout(random.randint(150, 300))
                
                # Intentar diferentes métodos de click
                success = False
                
                # Método 1: Click directo
                try:
                    await login_button.click(delay=random.randint(80, 150))
                    success = True
                except Exception as e:
                    print(f"Intento 1 fallido: {e}")
                
                # Método 2: Click via JavaScript
                if not success:
                    try:
                        await page.evaluate("(button) => button.click()", login_button)
                        success = True
                    except Exception as e:
                        print(f"Intento 2 fallido: {e}")
                
                # Método 3: Dispatch event
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
                
                await page.wait_for_load_state("networkidle", timeout=30000)
                print("✅ Navegación completada")
                
            except Exception as e:
                print(f"❌ Error al intentar hacer click en el botón: {str(e)}")
                raise
            
            # Verificar errores visibles
            modal_error = page.locator("text='ha ocurrido un error'")
            if await modal_error.count() > 0:
                print("⚠️ Modal de error detectado tras login")
                raise Exception("❌ Error visible en pantalla después de iniciar sesión")
            
            # Esperar y verificar errores en el contenido
            await page.wait_for_timeout(6000)
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
                raise Exception(f"❌ {error_msg.capitalize()}")
            
            # Verificar que estamos en la página correcta después del login
            current_url = page.url
            print(f"📍 URL actual: {current_url}")
            
            # Intentar detectar elementos que indiquen login exitoso
            try:
                success_selectors = [
                    "app-carrusel-productos-wrapper",
                    "app-card-producto",
                    ".dashboard",
                    ".home",
                    "[data-testid='dashboard']"
                ]
                
                login_success = False
                for selector in success_selectors:
                    try:
                        element = await page.wait_for_selector(selector, timeout=3000)
                        if element:
                            print(f"✅ Login exitoso detectado con selector: {selector}")
                            login_success = True
                            break
                    except Exception:
                        continue
                
                if not login_success:
                    # Verificar por URL o contenido específico
                    if "dashboard" in current_url.lower() or "home" in current_url.lower():
                        print("✅ Login exitoso detectado por URL")
                        login_success = True
                    elif "bienvenido" in content.lower() or "saldo" in content.lower():
                        print("✅ Login exitoso detectado por contenido")
                        login_success = True
                
                if login_success:
                    print("🎉 ¡LOGIN EXITOSO EN RENDER!")
                    return True
                else:
                    print("⚠️ No se pudo confirmar el login exitoso")
                    return False
                    
            except Exception as e:
                print(f"⚠️ Error al verificar login exitoso: {e}")
                return False
                
        except Exception as e:
            print(f"❌ Error durante el login: {str(e)}")
            raise

    async def test_login(self, rut: str, password: str):
        """Función principal para probar el login en Render"""
        print("🚀 Iniciando prueba de login en Render...")
        
        async with async_playwright() as p:
            # Configurar navegador optimizado para Render
            chrome_version = random.randint(110, 122)
            build_version = random.randint(0, 9999)
            user_agent = f'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{chrome_version}.0.{build_version}.0 Safari/537.36'
            
            # Configurar el contexto persistente para Render
            context = await p.chromium.launch_persistent_context(
                self.user_data_dir,
                headless=True,  # Headless para Render
                user_agent=user_agent,
                viewport={'width': 1920, 'height': 1080},
                locale='es-CL',
                timezone_id='America/Santiago',
                permissions=['geolocation'],
                geolocation=self.geolocation,  # Geolocalización fija
                accept_downloads=True,
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--no-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-extensions",
                    "--disable-infobars",
                    "--ignore-certificate-errors",
                    "--no-first-run",
                    "--no-service-autorun",
                    "--password-store=basic",
                    "--disable-gpu",
                    "--disable-software-rasterizer",
                    "--disable-background-timer-throttling",
                    "--disable-backgrounding-occluded-windows",
                    "--disable-renderer-backgrounding",
                    f"--user-agent={user_agent}"
                ]
            )

            # Script de evasión mejorado para Render
            await context.add_init_script("""
                const safeDefineProperty = (obj, prop, value) => {
                    try {
                        Object.defineProperty(obj, prop, {
                            value: value,
                            writable: false,
                            configurable: false,
                            enumerable: true
                        });
                    } catch (e) {
                        console.log(`Error setting ${prop}:`, e);
                    }
                };

                safeDefineProperty(navigator, 'webdriver', undefined);
                
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
                safeDefineProperty(navigator, 'connection', {
                    downlink: 10,
                    effectiveType: "4g",
                    rtt: 50,
                    saveData: false
                });
                safeDefineProperty(navigator, 'deviceMemory', 8);
                safeDefineProperty(navigator, 'hardwareConcurrency', 8);
                
                const originalQuery = window.navigator.permissions.query;
                window.navigator.permissions.query = (parameters) => (
                    parameters.name === 'notifications' 
                        ? Promise.resolve({state: Notification.permission})
                        : originalQuery(parameters)
                );
                
                safeDefineProperty(window, 'domAutomation', undefined);
                safeDefineProperty(window, 'domAutomationController', undefined);
                safeDefineProperty(window, '_WEBDRIVER_ELEM_CACHE', undefined);
                
                window.console.debug = () => {};
                
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
            
            # Configurar interceptor para headers específicos de Render
            await page.route("**/*", lambda route: route.continue_(
                headers={
                    **route.request.headers,
                    "sec-ch-ua": '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
                    "sec-ch-ua-mobile": "?0",
                    "sec-ch-ua-platform": '"Windows"',
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
                    "Accept-Language": "es-CL,es;q=0.9,en-US;q=0.8,en;q=0.7",
                    "Sec-Fetch-Dest": "document",
                    "Sec-Fetch-Mode": "navigate",
                    "Sec-Fetch-Site": "none",
                    "Sec-Fetch-User": "?1",
                    "Upgrade-Insecure-Requests": "1"
                }
            ))

            try:
                # Crear credenciales
                creds = Credentials(rut=rut, password=password)
                
                # Intentar login
                success = await self.login_banco_estado(page, creds)
                
                if success:
                    print("🎉 ¡PRUEBA EXITOSA EN RENDER! El scraper funciona en el hosting.")
                    print("💡 Ahora puedes expandir las funcionalidades para extraer datos.")
                    return True
                else:
                    print("❌ La prueba no fue exitosa en Render.")
                    return False
                    
            except Exception as e:
                print(f"❌ Error durante la prueba en Render: {str(e)}")
                return False
            finally:
                await context.close()

async def main():
    """Función principal para ejecutar desde consola"""
    print("🔐 BancoEstado Render Scraper - Prueba de Login")
    print("=" * 50)
    
    # Solicitar credenciales
    rut = input("Ingresa tu RUT (formato: 12.345.678-9): ").strip()
    password = input("Ingresa tu contraseña: ").strip()
    
    if not rut or not password:
        print("❌ Credenciales incompletas")
        return
    
    # Crear scraper y probar
    scraper = BancoEstadoRenderScraper()
    success = await scraper.test_login(rut, password)
    
    if success:
        print("\n✅ ¡Prueba completada exitosamente en Render!")
        print("💡 El scraper está funcionando correctamente en el hosting.")
    else:
        print("\n❌ La prueba no fue exitosa en Render.")
        print("💡 Revisa los errores anteriores para identificar el problema.")

if __name__ == "__main__":
    asyncio.run(main()) 