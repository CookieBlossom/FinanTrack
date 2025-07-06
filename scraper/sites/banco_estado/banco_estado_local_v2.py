#!/usr/bin/env python3
"""
BancoEstado Scraper - Versión Local V2
Técnicas avanzadas de evasión anti-detección
"""
import json
import random
import redis
import os
import re
import sys
import asyncio
import time
from datetime import datetime
from playwright.async_api import async_playwright
from dataclasses import dataclass
from typing import Optional, Dict, Any, List
import aiohttp

@dataclass
class Credentials:
    rut: str
    password: str

@dataclass
class ScraperConfig:
    redis_host: str
    redis_port: int
    debug_mode: bool = False
    geolocation: Dict[str, float] = None

    def __post_init__(self):
        if self.geolocation is None:
            self.geolocation = {
                "latitude": -33.4489,
                "longitude": -70.6693
            }

class BancoEstadoScraper:
    def __init__(self, config: ScraperConfig):
        self.config = config
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
    async def espera_aleatoria(self, page):
        """Espera aleatoria más realista"""
        base_time = random.randint(200, 600)  # Más lento para ser más realista
        jitter = random.randint(-50, 50)
        await page.wait_for_timeout(base_time + jitter)
    async def simular_movimiento_mouse_natural(self, page):
        """Simula movimientos de mouse más naturales"""
        viewport = page.viewport_size
        if not viewport:
            return
        for _ in range(random.randint(3, 6)):
            x = random.randint(50, viewport['width'] - 50)
            y = random.randint(50, viewport['height'] - 50)
            await page.mouse.move(x, y, steps=random.randint(5, 10))
            await page.wait_for_timeout(random.randint(100, 300))

    async def simular_scroll_natural(self, page):
        """Simula scroll natural"""
        await page.evaluate("""
            () => {
                const scrollAmount = Math.random() * 200 + 100;
                window.scrollBy({
                    top: scrollAmount,
                    behavior: 'smooth'
                });
            }
        """)
        await page.wait_for_timeout(random.randint(500, 800))

    async def cerrar_modal_infobar(self, page):
        """Cierra modales de infobar y sidebars"""
        try:
            await page.wait_for_timeout(1000)
            await page.evaluate("""() => {
                const closeButtons = Array.from(document.querySelectorAll('button[aria-label*="Close"], button[aria-label*="Cerrar"], .modal-close, .close-button'));
                for (const button of closeButtons) {
                    if (button.offsetParent !== null) {
                        button.click();
                    }
                }
            }""")
            await page.wait_for_timeout(600)
            modal_selectors = [
                "button.evg-btn-dismissal[aria-label*='Close']",
                "button.evg-btn-dismissal[aria-label*='Cerrar']",
                ".modal-close",
                ".close-button",
                "button[aria-label='Cerrar']",
                "button.msd-button--close",
                ".sidebar-container button[aria-label='Cerrar']",
                ".modal-container button[aria-label='Cerrar']",
                "#holidayid button[aria-label='Cerrar']",
                "#afpid button[aria-label='Cerrar']",
                "#promoid button[aria-label='Cerrar']",
                "#infoid button[aria-label='Cerrar']"
            ]
            
            for selector in modal_selectors:
                try:
                    modal_btn = page.locator(selector)
                    if await modal_btn.count() > 0 and await modal_btn.is_visible():
                        await modal_btn.click(timeout=2000)
                        await page.wait_for_timeout(600)
                        print(f"  Modal/Sidebar cerrado con selector: {selector}")
                except Exception:
                    continue
            dialogs = page.locator('[role="dialog"]')
            if await dialogs.count() > 0:
                for i in range(await dialogs.count()):
                    dialog = dialogs.nth(i)
                    if await dialog.is_visible():
                        try:
                            close_btn = dialog.locator("button[aria-label='Cerrar']")
                            if await close_btn.is_visible():
                                await close_btn.click()
                                await page.wait_for_timeout(600)
                                print("  [CLOSED] Dialog modal cerrado")
                        except Exception:
                            continue
            
        except Exception as e:
            print(f"  [WARNING] Info al intentar cerrar modales: {e}")

    async def cerrar_sidebar(self, page):
        try:
            sidebar_ids = ["holidayid", "afpid", "promoid", "infoid"]
            for sidebar_id in sidebar_ids:
                try:
                    sidebar = page.locator(f"#{sidebar_id} button[aria-label='Cerrar']")
                    if await sidebar.count() > 0 and await sidebar.is_visible():
                        await sidebar.click()
                        print(f"[CLOSED] Sidebar {sidebar_id} cerrado")
                        await page.wait_for_timeout(1000)
                        return True
                except Exception:
                    continue
            try:
                sidebar_class = page.locator(".sidebar-container button[aria-label='Cerrar'], .modal-container button[aria-label='Cerrar']")
                if await sidebar_class.count() > 0 and await sidebar_class.is_visible():
                    await sidebar_class.click()
                    print("[CLOSED] Sidebar genérico cerrado")
                    await page.wait_for_timeout(1000)
                    return True
            except Exception:
                pass
            try:
                close_buttons = page.locator("button[aria-label='Cerrar']").all()
                for button in await close_buttons:
                    try:
                        if await button.is_visible():
                            parent = await button.evaluate("""
                                (button) => {
                                    const container = button.closest('.sidebar-container, .modal-container, [role="dialog"]');
                                    return container ? true : false;
                                }
                            """)
                            if parent:
                                await button.click()
                                print("[CLOSED] Sidebar/modal cerrado")
                                await page.wait_for_timeout(1000)
                                return True
                    except Exception:
                        continue
            except Exception:
                pass
            print("[OK] No hay sidebars para cerrar")
            return False
        except Exception as e:
            print(f"[INFO] Info: {str(e)}")
            return False

    async def type_like_human(self, page, selector, text, delay=None):
        """Simula escritura humana más realista"""
        try:
            element = await page.wait_for_selector(selector, state="visible")
            await element.click()
            await page.wait_for_timeout(random.randint(300, 500))
            await element.fill("")
            await page.wait_for_timeout(random.randint(350, 400))
            if delay is None:
                if "pass" in selector.lower():
                    base_delay = random.randint(200, 550)
                else:
                    base_delay = random.randint(250, 550)
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
                
                if random.random() < 0.005:
                    wrong_char = random.choice('qwertyuiopasdfghjklzxcvbnm')
                    await element.type(wrong_char, delay=char_delay)
                    await page.wait_for_timeout(random.randint(400, 500))
                    await page.keyboard.press('Backspace')
                    await page.wait_for_timeout(random.randint(200, 400))
                await element.type(char, delay=char_delay)
                
                if random.random() < 0.015:
                    await page.wait_for_timeout(random.randint(300, 800))
            
            await page.wait_for_timeout(random.randint(400, 1200))
            
        except Exception as e:
            print(f"ERROR en type_like_human: {e}")
            await page.fill(selector, text)

    async def simular_comportamiento_humano(self, page):
        """Simula comportamiento humano más realista"""
        for _ in range(random.randint(2, 4)):
            x = random.randint(100, 1200)
            y = random.randint(100, 800)
            await page.mouse.move(x, y, steps=random.randint(3, 6))
            await page.wait_for_timeout(random.randint(100, 300))
        
        await page.evaluate("""
            window.scrollTo({
                top: Math.random() * document.body.scrollHeight * 0.3,
                behavior: 'smooth'
            });
        """)
        await page.wait_for_timeout(random.randint(400, 1200))

    async def mostrar_saldos(self, page):
        try:
            await self.cerrar_sidebar(page)
            print("[VIEW] Intentando mostrar saldos...")
            
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
                
                await page.wait_for_timeout(800)
                
                if await self.verificar_saldos_visibles(page):
                    print("[OK] Saldos mostrados correctamente")
                    return True
                    
                await page.wait_for_timeout(500)
                if await self.verificar_saldos_visibles(page):
                    print("[OK] Saldos mostrados correctamente en segundo intento")
                    return True
                    
                print("[WARNING] No se pudieron mostrar los saldos")
                return False
                
            except Exception as e:
                print(f"ERROR: Error al mostrar saldos: {e}")
                return False
                
        except Exception as e:
            print(f"ERROR: Error general al mostrar saldos: {e}")
            return False

    async def verificar_saldos_visibles(self, page):
        try:
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
            try:
                nombre_obtenido = False
                nombre_el_visible_not_sr = card.locator("h3:not(.sr_only):visible")
                if await nombre_el_visible_not_sr.count() > 0:
                    nombre = await nombre_el_visible_not_sr.first.text_content()
                    if nombre:
                        info["nombre"] = nombre.strip()
                        nombre_obtenido = True
                if not nombre_obtenido:
                    nombre_el_aria_hidden = card.locator("h3[aria-hidden='true']")
                    if await nombre_el_aria_hidden.count() > 0:
                        nombre = await nombre_el_aria_hidden.first.text_content()
                        if nombre:
                            info["nombre"] = nombre.strip()
                            nombre_obtenido = True
                if not nombre_obtenido:
                    nombre_el_not_sr = card.locator("h3:not(.sr_only)")
                    if await nombre_el_not_sr.count() > 0:
                        nombre = await nombre_el_not_sr.first.text_content()
                        if nombre:
                            info["nombre"] = nombre.strip()
                            nombre_obtenido = True

            except Exception as e:
                print(f"[WARNING] Error al extraer nombre con selectores h3 directos: {e}")
            if "nombre" not in info or not info.get("nombre"):
                try:
                    nombre_obtenido_alt = False
                    alt_nombre_el_visible_not_sr = card.locator(".m-card-global__header--title h3:not(.sr_only):visible")
                    if await alt_nombre_el_visible_not_sr.count() > 0:
                        nombre_alt = await alt_nombre_el_visible_not_sr.first.text_content()
                        if nombre_alt:
                            info["nombre"] = nombre_alt.strip()
                            nombre_obtenido_alt = True
                    if not nombre_obtenido_alt:
                        alt_nombre_el_aria_hidden = card.locator(".m-card-global__header--title h3[aria-hidden='true']")
                        if await alt_nombre_el_aria_hidden.count() > 0:
                            nombre_alt = await alt_nombre_el_aria_hidden.first.text_content()
                            if nombre_alt:
                                info["nombre"] = nombre_alt.strip()
                                nombre_obtenido_alt = True
                    if not nombre_obtenido_alt:
                        alt_nombre_el_not_sr = card.locator(".m-card-global__header--title h3:not(.sr_only)")
                        if await alt_nombre_el_not_sr.count() > 0:
                            nombre_alt = await alt_nombre_el_not_sr.first.text_content()
                            if nombre_alt:
                                info["nombre"] = nombre_alt.strip()
                                
                except Exception as e_alt:
                    print(f"[WARNING] Error al extraer nombre con selector alternativo: {e_alt}")
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
                    print(f"[WARNING] Error al extraer nombre del HTML: {e}")
            try:
                numero_el = card.locator(".m-card-global__header--title p")
                if await numero_el.count() > 0:
                    numero = await numero_el.text_content()
                    info["numero"] = numero.strip()
                else:
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
            try:
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
            if not info["nombre"] or info["nombre"] == "Cuenta sin nombre":
                if not info["numero"] and not info["saldo"]:
                    return None
            return info
        except Exception as e:
            print(f"ERROR: Error general al extraer info de tarjeta: {e}")
            return None

    async def extract_cuentas(self, page):
        print("Extrayendo cuentas...")
        await self.cerrar_modal_infobar(page)
        
        try:
            await page.wait_for_selector("app-carrusel-productos-wrapper", timeout=30000)
            print("Encontramos el carrusel")
        except Exception as e:
            print(f"[WARNING] No se encontró el carrusel: {e}")
            # Intentar un selector alternativo más genérico
            try:
                await page.wait_for_selector("div[role='list'], div.carousel, div.slider", timeout=15000)
                print("Encontramos un carrusel alternativo")
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
        for selector in selectores_tarjetas:
            try:
                cards = await page.locator(selector).all()
                if not cards:
                    continue
                for card in cards:
                    cuenta_info = await self.extraer_info_tarjeta(card)
                    if cuenta_info:
                        cuenta_formateada = {
                            "numero": cuenta_info.get("numero", ""),
                            "tipo": cuenta_info.get("nombre", ""),
                            "saldo": self.convertir_saldo_a_float(cuenta_info.get("saldo", "0")),
                            "moneda": "CLP",
                            "titular": "",  # Por ahora no tenemos el titular
                            "estado": "activa"
                        }
                        if not any(c.get("numero") == cuenta_formateada["numero"] for c in cuentas):
                            cuentas.append(cuenta_formateada)
                            total_cuentas += 1
                            print(f" Cuenta #{total_cuentas}: {cuenta_formateada['tipo']} - {cuenta_formateada['numero']} - Saldo: ${cuenta_formateada['saldo']:,.0f}")
                try:
                    next_button = page.locator("button[aria-label='Siguiente']")
                    if await next_button.count() > 0 and await next_button.is_visible():
                        await next_button.click()
                        await page.wait_for_timeout(2000)  # Esperar a que carguen las nuevas tarjetas
                    else:
                        break  # No hay más tarjetas para ver
                except Exception as e:
                    print(f"[INFO] Info al avanzar: {e}")
                    break  # Si hay error al avanzar, asumimos que no hay más tarjetas
            except Exception as e:
                print(f"[INFO] Info con selector {selector}: {e}")
                continue
        if not cuentas:
            print("[WARNING] No se encontraron cuentas con métodos estándar. Intentando extracción directa del HTML...")
            try:
                raw_cuentas = await page.evaluate("""
                    () => {
                        try {
                            const tarjetas = Array.from(document.querySelectorAll('div[class*="card"], div[class*="producto"], div[class*="cuenta"]'));
                            return tarjetas.map(tarjeta => {
                                const textContent = tarjeta.textContent || '';
                                const textoCompleto = textContent.replace(/\\s+/g, ' ').trim();
                                const saldoMatch = textoCompleto.match(/\\$[\\d.,]+/);
                                const saldo = saldoMatch ? saldoMatch[0] : '';
                                
                                let nombre = '';
                                const titulos = tarjeta.querySelectorAll('h1, h2, h3, h4, h5, div[class*="title"]');
                                if (titulos.length > 0) {
                                    nombre = titulos[0].textContent.trim();
                                } else {
                                    const textos = Array.from(tarjeta.querySelectorAll('div, span'))
                                        .map(el => el.textContent.trim())
                                        .filter(texto => texto.length > 3 && texto.length < 50);
                                    if (textos.length > 0) {
                                        nombre = textos[0];
                                    }
                                }
                                
                                let numero = '';
                                const numeroMatch = textoCompleto.match(/\\b\\d{8,}\\b/);
                                if (numeroMatch) {
                                    numero = numeroMatch[0];
                                }
                                
                                return {
                                    nombre: nombre || 'Cuenta sin nombre',
                                    numero: numero,
                                    saldo: saldo,
                                    html: tarjeta.outerHTML.substring(0, 500)
                                };
                            }).filter(cuenta => cuenta.nombre !== 'Cuenta sin nombre' || cuenta.saldo || cuenta.numero);
                        } catch (e) {
                            console.error('Error en extracción JS:', e);
                            return [];
                        }
                    }
                """)
                
                for cuenta_raw in raw_cuentas:
                    if not any(c.get("nombre") == cuenta_raw.get("nombre") and c.get("numero") == cuenta_raw.get("numero") for c in cuentas):
                        cuentas.append({
                            "nombre": cuenta_raw.get("nombre", ""),
                            "numero": cuenta_raw.get("numero", ""),
                            "saldo": cuenta_raw.get("saldo", ""),
                            "extraido_html": True
                        })
                        total_cuentas += 1
                        print(f" Cuenta extraída de HTML #{total_cuentas}: {cuenta_raw.get('nombre')} - {cuenta_raw.get('numero')} - Saldo: {cuenta_raw.get('saldo')}")
            except Exception as e:
                print(f"[WARNING] Error en extracción alternativa: {e}")
        
        if not cuentas:
            raise Exception("No se pudo extraer ninguna cuenta")
        
        print(f"[OK] Se extrajeron {len(cuentas)} cuentas exitosamente")
        return cuentas

    async def extract_movimientos_cuenta(self, page, cuenta_info):
        """Extrae los movimientos de una cuenta específica"""
        movimientos = []
        try:
            print(f"\n Extrayendo movimientos para cuenta: {cuenta_info.get('nombre', 'N/A')} ({cuenta_info.get('numero', 'N/A')})")
            await self.verificar_y_volver_home(page)
            await page.wait_for_timeout(2000)
            await self.cerrar_modal_infobar(page)
            await self.cerrar_sidebar(page)

            carrusel = page.locator("app-carousel-productos")  # Cambiado a selector original
            if await carrusel.count() == 0:
                carrusel = page.locator("app-carrusel-productos-wrapper")
                if await carrusel.count() == 0:
                    raise Exception("No se encontró el carrusel de productos")
            tarjetas = page.locator("app-card-producto:visible, app-card-ahorro:visible")
            num_tarjetas = await tarjetas.count()
            for i in range(num_tarjetas):
                tarjeta = tarjetas.nth(i)
                info_tarjeta = await self.extraer_info_tarjeta(tarjeta)
                if info_tarjeta and info_tarjeta.get('numero') == cuenta_info.get('numero'):
                    print(f"  [OK] Tarjeta encontrada: {info_tarjeta.get('nombre')}")
                    boton_movs = tarjeta.locator("button:has-text('Movimientos')")
                    if await boton_movs.count() == 0:
                        boton_movs = tarjeta.locator("button:has-text('Ver Movimientos')")
                    if await boton_movs.count() > 0:
                        await boton_movs.click()
                        print(" Esperando carga de página de movimientos...")
                        await page.wait_for_load_state("networkidle", timeout=7000)
                        await page.wait_for_timeout(3000)
                        await self.cerrar_modal_infobar(page)
                        await self.cerrar_sidebar(page)
                        try:
                            print(" Buscando tabla de movimientos...")
                            # Lista de selectores para la tabla de movimientos
                            tabla_selectors = [
                                "app-listado-movimientos table",
                                "div[class*='movimientos'] table",
                                "app-movimientos table",
                                ".tabla-movimientos",
                                "table.ag-table",
                                "table.movimientos-table",
                                "div[role='grid']",
                                "div.ag-body-viewport",
                                "div.ag-center-cols-container"
                            ]
                            
                            tabla_movs = None
                            for selector in tabla_selectors:
                                tabla = page.locator(selector)
                                if await tabla.count() > 0 and await tabla.is_visible():
                                    print(f"    [OK] Tabla encontrada con selector: {selector}")
                                    tabla_movs = tabla
                                    break
                            
                            if not tabla_movs:
                                # Intentar encontrar cualquier tabla visible
                                todas_tablas = page.locator("table")
                                num_tablas = await todas_tablas.count()
                                for i in range(num_tablas):
                                    tabla = todas_tablas.nth(i)
                                    if await tabla.is_visible():
                                        print("    [OK] Tabla encontrada usando selector genérico")
                                        tabla_movs = tabla
                                        break
                            
                            if not tabla_movs:
                                raise Exception("No se encontró la tabla de movimientos")
                            
                            print("    [OK] Tabla de movimientos cargada")
                            pagina = 1
                            while pagina <= 10:  # Límite de 10 páginas
                                print(f" Procesando página {pagina}")
                                await page.wait_for_timeout(1000)
                                try:
                                    # Lista de selectores para las filas
                                    fila_selectors = [
                                        "tbody tr",
                                        "div[role='row']",
                                        ".ag-row",
                                        "div[class*='row']"
                                    ]
                                    
                                    filas = None
                                    for selector in fila_selectors:
                                        filas_temp = await tabla_movs.locator(selector).all()
                                        if filas_temp:
                                            print(f"      [OK] Filas encontradas con selector: {selector}")
                                            filas = filas_temp
                                            break
                                    
                                    if not filas:
                                        print("      [WARNING] No se encontraron filas en la tabla")
                                        break
                                    
                                    for fila in filas:
                                        try:
                                            # Lista de selectores para las columnas
                                            fecha_selectors = [
                                                "td[role='cell']:nth-child(2) p",
                                                "td[role='cell'] div.contentText p",
                                                "div[col-id='fecha'] p",
                                                ".contentText p",
                                                "p.ng-star-inserted",
                                                "td p"
                                            ]
                                            desc_selectors = [
                                                "td[role='cell']:nth-child(3) button",
                                                "td[role='cell'] div.contentText.largoDescripcition button",
                                                ".contentText.largoDescripcition button",
                                                "button.msd-button--link"
                                            ]
                                            monto_selectors = [
                                                "td[role='cell']:nth-child(5) p.amountsTransferClp span",
                                                "td[role='cell'] div.contentText p.amountsTransferClp span",
                                                ".contentText p.amountsTransferClp span",
                                                "p.amountsTransferClp span"
                                            ]
                                            
                                            fecha = None
                                            descripcion = None
                                            monto_str = None
                                            es_cargo = False
                                            
                                            # Intentar obtener fecha
                                            for selector in fecha_selectors:
                                                try:
                                                    fecha_el = fila.locator(selector)
                                                    if await fecha_el.count() > 0:
                                                        fecha_text = await fecha_el.text_content()
                                                        if fecha_text and fecha_text.strip():
                                                            fecha = fecha_text.strip()
                                                            # Verificar si la fecha tiene el formato correcto (dd/mm/yyyy)
                                                            if re.match(r'\d{2}/\d{2}/\d{4}', fecha):
                                                                break
                                                except Exception:
                                                    continue
                                            
                                            # Si no se encontró la fecha, intentar extraerla del HTML
                                            if not fecha:
                                                try:
                                                    html = await fila.evaluate("el => el.innerHTML")
                                                    fecha_match = re.search(r'(\d{2}/\d{2}/\d{4})', html)
                                                    if fecha_match:
                                                        fecha = fecha_match.group(1)
                                                except Exception:
                                                    pass
                                            
                                            # Intentar obtener descripción
                                            for selector in desc_selectors:
                                                try:
                                                    desc_el = fila.locator(selector)
                                                    if await desc_el.count() > 0:
                                                        descripcion = await desc_el.text_content()
                                                        if descripcion and descripcion.strip():
                                                            descripcion = descripcion.strip()
                                                            break
                                                except Exception:
                                                    continue
                                            
                                            # Intentar obtener monto
                                            for selector in monto_selectors:
                                                try:
                                                    monto_el = fila.locator(selector)
                                                    if await monto_el.count() > 0:
                                                        monto_str = await monto_el.text_content()
                                                        if monto_str and monto_str.strip():
                                                            # Verificar si es cargo o abono
                                                            es_cargo = "-" in monto_str
                                                            # Limpiar el monto
                                                            monto_str = monto_str.replace("-", "").replace("+", "").strip()
                                                            break
                                                except Exception:
                                                    continue
                                            
                                            if fecha and descripcion and monto_str:
                                                monto = self.convertir_saldo_a_float(monto_str)
                                                movimientos.append({
                                                    'fecha': fecha,
                                                    'descripcion': descripcion,
                                                    'monto': -monto if es_cargo else monto
                                                })
                                                print(f"      [+] Movimiento: {fecha} | {descripcion} | ${monto:,.0f} {'(cargo)' if es_cargo else '(abono)'}")
                                            else:
                                                print(f"      [WARNING] Fila incompleta - Fecha: {fecha} Desc: {descripcion} Monto: {monto_str}")
                                                # Intentar extraer datos del HTML directamente
                                                try:
                                                    html = await fila.evaluate("el => el.innerHTML")
                                                    print(f" HTML de la fila: {html}")
                                                except Exception:
                                                    pass
                                        except Exception as e:
                                            print(f"      [WARNING] Error procesando fila: {e}")
                                            continue
                                except Exception as e:
                                    print(f"      [WARNING] Error procesando tabla: {e}")
                                    break
                                
                                if len(movimientos) == 0:
                                    print("      [INFO] No hay movimientos en esta página")
                                    break
                                
                                # Lista de selectores para el botón siguiente y paginación
                                siguiente_selectors = [
                                    "button.btn-next:not([disabled])",
                                    "button[aria-label='Siguiente']:not([disabled])",
                                    ".pagination-next:not([disabled])",
                                    "button:has-text('Siguiente'):not([disabled])",
                                    ".ag-paging-button[ref='btNext']:not(.ag-disabled)",
                                    "button.next-page:not([disabled])",
                                    "li.page-item:not(.disabled) a.page-link[aria-label='Siguiente']",
                                    "[aria-label='next page']",
                                    "button.msd-button:has-text('Siguiente')",
                                    ".pagination button:not([disabled]):has-text('Siguiente')"
                                ]
                                
                                tiene_siguiente = False
                                for selector in siguiente_selectors:
                                    try:
                                        btn = page.locator(selector)
                                        if await btn.count() > 0:
                                            is_visible = await btn.is_visible()
                                            is_enabled = await btn.evaluate("el => !el.disabled")
                                            if is_visible and is_enabled:
                                                print(f"      [OK] Botón siguiente encontrado con selector: {selector}")
                                                await btn.click()
                                                await page.wait_for_timeout(2000)  # Esperar a que cargue la siguiente página
                                                tiene_siguiente = True
                                                break
                                    except Exception:
                                        continue                                
                                if not tiene_siguiente:
                                    try:
                                        # Buscar elementos de paginación por número
                                        paginas = page.locator(".pagination li, .page-item, [role='listitem']")
                                        num_paginas = await paginas.count()
                                        for i in range(num_paginas):
                                            pagina_el = paginas.nth(i)
                                            if await pagina_el.is_visible():
                                                texto = await pagina_el.text_content()
                                                # Si encontramos un número mayor que la página actual
                                                if texto.isdigit() and int(texto) == pagina + 1:
                                                    print(f"[OK] Encontrado botón de página {texto}")
                                                    await pagina_el.click()
                                                    await page.wait_for_timeout(2000)
                                                    tiene_siguiente = True
                                                    break
                                    except Exception as e:
                                        print(f"      [INFO] Info al buscar números de página: {e}")
                                
                                if not tiene_siguiente:
                                    print("      [INFO] No hay más páginas")
                                    break
                                
                                pagina += 1
                                print(f"      [OK] Navegando a página {pagina}")
                                await page.wait_for_timeout(1000)
                            print(f"  [OK] Total de movimientos extraídos para esta cuenta: {len(movimientos)}")
                            await self.verificar_y_volver_home(page)
                        except Exception as e:
                            print(f"    ERROR: Error al procesar movimientos: {e}")
                        await self.verificar_y_volver_home(page)
                        break
                    else:
                        print("  [WARNING] No se encontró el botón de movimientos")

            return movimientos
        except Exception as e:
            print(f"ERROR: Error extrayendo movimientos: {e}")
            return movimientos

    async def verificar_y_volver_home(self, page):
        """Verifica si estamos en la página principal y vuelve si es necesario"""
        try:
            if await page.locator("app-carrusel-productos-wrapper").count() > 0:
                print("  Ya estamos en la página principal")
                return True
            print("  Intentando volver a home...")
            try:
                logo = page.locator("#logoBechHomeIndex")
                if await logo.count() > 0:
                    await logo.click()
                    await page.wait_for_load_state("networkidle")
                    await page.wait_for_timeout(1000)
                    print("  [OK] Volvimos a home usando el logo")
                    return True
                inicio_button = page.locator("button[aria-label='Inicio']").first
                if await inicio_button.count() > 0:
                    await inicio_button.click()
                    await page.wait_for_load_state("networkidle")
                    await page.wait_for_timeout(1000)
                    print("  [OK] Volvimos a home usando el botón de inicio")
                    return True
                print("  Intentando navegar directamente a home...")
                await page.goto("https://www.bancoestado.cl/personas/home", wait_until="networkidle")
                await page.wait_for_timeout(1000)
                print("  [OK] Navegación directa a home exitosa")
                return True
                
            except Exception as e:
                print(f"  [WARNING] Error al intentar volver a home: {e}")
                try:
                    await page.reload()
                    await page.wait_for_load_state("networkidle")
                    print("  [OK] Página recargada como último recurso")
                    return True
                except Exception as e2:
                    print(f"  ERROR: Error al recargar la página: {e2}")
                    return False
            
        except Exception as e:
            print(f"  ERROR: Error al intentar volver a home: {e}")
            return False

    def guardar_en_json(self, nombre_archivo: str, data: dict):
        """Guarda los datos en un archivo JSON"""
        try:
            os.makedirs(os.path.dirname(nombre_archivo), exist_ok=True)
            if 'cuentas' in data:
                for cuenta in data['cuentas']:
                    cuenta['saldo'] = float(cuenta.get('saldo', 0))
                    if 'movimientos' in cuenta:
                        for mov in cuenta['movimientos']:
                            mov['monto'] = float(mov.get('monto', 0))
            
            with open(nombre_archivo, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print(f"[OK] Datos guardados en {nombre_archivo}")
        except Exception as e:
            print(f"ERROR: Error al guardar datos: {e}")

    def convertir_saldo_a_float(self, saldo_str: str) -> float:
        """Convierte un string de saldo a float"""
        try:
            saldo_str = saldo_str.replace('$', '').replace('.', '')
            saldo_str = saldo_str.replace(',', '.')
            return float(saldo_str)
        except Exception:
            return 0.0

    async def run(self, task_id: str, task_data: dict) -> dict:
        """
        Método principal que ejecuta el scraping completo y procesa los movimientos
        """
        try:
            print(f"[INFO] Iniciando scraping para tarea {task_id}")
            
            # Extraer credenciales
            credentials = Credentials(
                rut=task_data['data']['rut'],
                password=task_data['data']['password']
            )
            
            async with async_playwright() as p:
                # Configurar el navegador según el entorno
                import os
                
                # Detectar si estamos en Railway
                is_railway = os.getenv('RAILWAY_ENVIRONMENT') == 'production'
                
                if is_railway:
                    # Configuración para Railway (con display virtual)
                    browser_args = [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-blink-features=AutomationControlled',
                        '--disable-web-security',
                        '--disable-extensions',
                        '--no-first-run',
                        '--display=:99'
                    ]
                    browser = await p.chromium.launch(
                        headless=False,  # Mantener interfaz gráfica
                        slow_mo=50,
                        args=browser_args
                    )
                else:
                    # Configuración local (normal)
                    browser = await p.chromium.launch(
                        headless=False,
                        slow_mo=50
                    )
                
                # Configurar el contexto
                context = await browser.new_context(
                    user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                    locale="es-CL",
                    permissions=["geolocation"],
                    geolocation=self.config.geolocation,
                    timezone_id="America/Santiago",
                    viewport={"width": 1920, "height": 1080}
                )
                
                # Configurar evasión de detección
                await context.add_init_script("""
                    Object.defineProperty(navigator, 'webdriver', {
                        get: () => undefined
                    });
                """)
                
                page = await context.new_page()
                
                # Realizar login
                print("[INFO] Realizando login...")
                try:
                    login_exitoso = await self.login_banco_estado(page, credentials)
                    if not login_exitoso:
                        await browser.close()
                        error_result = {
                            "success": False,
                            "error": "Login fallido",
                            "fecha_extraccion": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                        }
                        print(f"[ERROR] Login fallido para tarea {task_id}")
                        return error_result
                except Exception as login_error:
                    await browser.close()
                    error_result = {
                        "success": False,
                        "error": f"Error durante login: {str(login_error)}",
                        "fecha_extraccion": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    }
                    print(f"[ERROR] Error de login para tarea {task_id}: {login_error}")
                    return error_result
                
                # Extraer cuentas
                print("[INFO] Extrayendo cuentas...")
                try:
                    cuentas = await self.extract_cuentas(page)
                    
                    # Extraer movimientos por cuenta
                    print("[INFO] Extrayendo movimientos por cuenta...")
                    for cuenta in cuentas:
                        movimientos_cuenta = await self.extract_movimientos_cuenta(page, cuenta)
                        cuenta['movimientos'] = movimientos_cuenta
                        
                except Exception as extract_error:
                    await browser.close()
                    error_result = {
                        "success": False,
                        "error": f"Error extrayendo datos: {str(extract_error)}",
                        "fecha_extraccion": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    }
                    print(f"[ERROR] Error extrayendo datos para tarea {task_id}: {extract_error}")
                    return error_result
                
                await browser.close()
                
                # Procesar y categorizar movimientos
                print("[INFO] Procesando y categorizando movimientos...")
                try:
                    processed_result = await self.process_and_categorize_movements(cuentas, task_data)
                except Exception as process_error:
                    error_result = {
                        "success": False,
                        "error": f"Error procesando movimientos: {str(process_error)}",
                        "fecha_extraccion": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    }
                    print(f"[ERROR] Error procesando movimientos para tarea {task_id}: {process_error}")
                    return error_result
                
                # Preparar resultado final
                resultado = {
                    "success": True,
                    "fecha_extraccion": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "cuentas": cuentas,
                    "total_cuentas": len(cuentas),
                    "total_movimientos": sum(len(cuenta.get('movimientos', [])) for cuenta in cuentas),
                    "processed_movements": processed_result.get('processed_movements', []),
                    "categorization_stats": processed_result.get('categorization_stats', {})
                }
                
                # Guardar resultado local
                os.makedirs('results', exist_ok=True)
                self.guardar_en_json(
                    f'results/banco_estado_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json',
                    resultado
                )
                
                print(f"[OK] Scraping completado exitosamente:")
                print(f"  - Cuentas extraídas: {len(cuentas)}")
                print(f"  - Movimientos procesados: {sum(len(cuenta.get('movimientos', [])) for cuenta in cuentas)}")
                print(f"  - Movimientos categorizados: {processed_result.get('categorization_stats', {}).get('categorized', 0)}")
                
                return resultado
                
        except Exception as e:
            print(f"[ERROR] Error crítico durante el scraping para tarea {task_id}: {str(e)}")
            import traceback
            traceback.print_exc()
            error_result = {
                "success": False,
                "error": str(e),
                "fecha_extraccion": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
            return error_result

    async def process_and_categorize_movements(self, cuentas: List[dict], task_data: dict) -> dict:
        """
        Procesa y categoriza los movimientos utilizando el sistema de companies.json del backend
        """
        import aiohttp
        import json
        import os
        
        # Obtener companies.json desde el backend API
        backend_url = os.getenv('BACKEND_URL', 'http://localhost:3000')
        
        # Agregar protocolo https si no está presente y es Railway
        if 'railway.app' in backend_url and not backend_url.startswith('http'):
            backend_url = f"https://{backend_url}"
        
        companies = []
        
        try:
            print(f"[INFO] Obteniendo companies.json desde: {backend_url}/config/companies")
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{backend_url}/config/companies") as response:
                    if response.status == 200:
                        result = await response.json()
                        if result.get('success') and result.get('data'):
                            companies = result['data']
                            print(f"[INFO] Cargadas {len(companies)} empresas para categorización desde API")
                        else:
                            print(f"[WARNING] Respuesta del backend sin datos: {result}")
                    else:
                        print(f"[WARNING] Error al obtener companies.json: HTTP {response.status}")
        except Exception as e:
            print(f"[WARNING] No se pudo obtener companies.json desde API: {e}")
            print(f"[WARNING] URL intentada: {backend_url}/config/companies")
        
        processed_movements = []
        categorization_stats = {
            'total': 0,
            'categorized': 0,
            'uncategorized': 0
        }
        
        for cuenta in cuentas:
            for movimiento in cuenta.get('movimientos', []):
                # Procesar movimiento
                processed_movement = self.process_single_movement(movimiento, cuenta, companies)
                processed_movements.append(processed_movement)
                
                # Actualizar estadísticas
                categorization_stats['total'] += 1
                if processed_movement.get('categoria_automatica'):
                    categorization_stats['categorized'] += 1
                else:
                    categorization_stats['uncategorized'] += 1
        
        # Enviar movimientos al backend
        if processed_movements:
            await self.send_movements_to_backend(processed_movements, task_data, cuentas)
        
        return {
            'processed_movements': processed_movements,
            'categorization_stats': categorization_stats
        }
    
    def process_single_movement(self, movimiento: dict, cuenta: dict, companies: List[dict]) -> dict:
        """
        Procesa un movimiento individual y lo categoriza
        Estructura exacta que espera el backend según IScraperMovement
        """
        descripcion = movimiento.get('descripcion', '').strip()
        descripcion_clean = self.clean_description(descripcion)
        tipo = self.extract_transaction_type(descripcion)
        referencia = self.extract_reference(descripcion)
        categoria_automatica = self.find_automatic_category_improved(descripcion_clean, companies)
        processed_movement = {
            'fecha': movimiento.get('fecha'),                    # string - fecha ISO
            'descripcion': descripcion,                          # string - descripción del movimiento
            'monto': movimiento.get('monto'),                    # number - monto (+ para ingresos, - para gastos)
            'categoria_automatica': categoria_automatica,        # string - categoría automática
            'tipo': tipo,                                        # string - tipo de movimiento según banco
            'cuenta': cuenta.get('numero'),                      # string - número de cuenta
            'referencia': referencia,                            # string - referencia de transacción
            'estado': 'completado',                              # string - estado del movimiento
            'movement_type': 'expense' if movimiento.get('monto', 0) < 0 else 'income'  # 'income' | 'expense'
        }
        
        return processed_movement
    
    def clean_description(self, descripcion: str) -> str:
        """
        Limpia la descripción del movimiento eliminando prefijos genéricos
        """
        import re
        
        prefijos_a_ignorar = [
            'TEF A ',
            'COMPRA WEB ',
            'COMPRA NACIONAL ',
            'COMPRA INTERNACIONAL ',
            'COMPRA POS ',
            'TRANSFERENCIA A ',
            'TRANSFERENCIA DE ',
            'PAGO DE ',
            'PAGO A ',
            'FACTU CL',
            'FACTURACION ',
            'CARGO POR ',
            'ABONO DE ',
            'GIRO EN ',
            'DEP POR ',
            'COMISION '
        ]
        
        desc = descripcion.strip()
        
        # Eliminar prefijos comunes
        for prefijo in prefijos_a_ignorar:
            if desc.upper().startswith(prefijo.upper()):
                desc = desc[len(prefijo):].strip()
        
        # Limpiar múltiples espacios
        desc = re.sub(r'\s+', ' ', desc)
        
        # Eliminar sufijos comunes
        sufijos_a_ignorar = ['CL', 'CHILE', 'LTDA', 'S.A.']
        for sufijo in sufijos_a_ignorar:
            if desc.upper().endswith(' ' + sufijo.upper()):
                desc = desc[:-len(sufijo)-1].strip()
        
        return desc
    
    def extract_transaction_type(self, descripcion: str) -> str:
        """
        Extrae el tipo de transacción de la descripción
        """
        desc_upper = descripcion.upper().strip()
        
        # Patrones de tipos de transacción más específicos
        tipos = {
            'TRANSFERENCIA_ENVIADA': ['TEF A ', 'TRANSFERENCIA A '],
            'TRANSFERENCIA_RECIBIDA': ['DEP POR TRANSFERENCIA', 'TRANSFERENCIA RECIBIDA'],
            'COMPRA_WEB': ['COMPRA WEB'],
            'COMPRA_PRESENCIAL': ['COMPRA NACIONAL', 'COMPRA POS'],
            'GIRO_ATM': ['GIRO ATM', 'GIRO EN ATM'],
            'GIRO_TRANSFERENCIA': ['GIRO POR TRANSFERENCIA'],
            'COMISION': ['COMISION'],
            'INTERES': ['INTERES', 'RENDIMIENTO'],
            'AHORRO': ['AHORRO'],
            'PAGO_SERVICIO': ['PAGO SERVICIO', 'PAGO DE SERVICIO'],
            'ABONO': ['ABONO'],
            'CARGO': ['CARGO']
        }
        
        for tipo, patrones in tipos.items():
            for patron in patrones:
                if patron in desc_upper:
                    return tipo
        
        # Tipo por defecto basado en el monto
        return 'OTROS'
    
    def extract_reference(self, descripcion: str) -> str:
        """
        Extrae número de referencia o código de la descripción cuando sea relevante
        """
        import re
        
        # Patrones para extraer referencias
        patterns = [
            r'REF[:\s]*(\d+)',           # REF: 123456
            r'NRO[:\s]*(\d+)',           # NRO: 123456  
            r'CODIGO[:\s]*(\d+)',        # CODIGO: 123456
            r'(\d{6,})',                 # Números de 6+ dígitos
            r'[A-Z]{2,}\s*(\d{4,})'      # Códigos alfanuméricos
        ]
        
        for pattern in patterns:
            match = re.search(pattern, descripcion.upper())
            if match:
                return match.group(1) if match.groups() else match.group(0)
        
        return None
    
    def find_automatic_category_improved(self, descripcion: str, companies: List[dict]) -> str:
        """
        Busca automáticamente la categoría basada en companies.json (sistema que ya funciona)
        """
        # Usar solo el sistema companies.json que ya funciona bien con la cartola
        if companies:
            descripcion_normalized = descripcion.upper().replace(' ', '')
            
            for company in companies:
                for keyword in company.get('keywords', []):
                    keyword_normalized = keyword.upper().replace(' ', '')
                    if keyword_normalized in descripcion_normalized:
                        return company.get('category', 'Otros')
        
        # Fallback a "Otros" si no encuentra coincidencia
        return "Otros"
    
    async def send_movements_to_backend(self, movements: List[dict], task_data: dict, cuentas: List[dict]) -> None:
        """
        Envía los movimientos procesados al backend
        """
        import aiohttp
        import json
        import os
        
        # URL del backend - detectar automáticamente el entorno
        backend_url = os.getenv('BACKEND_URL', 'http://localhost:3000')
        
        # Agregar protocolo https si no está presente y es Railway
        if 'railway.app' in backend_url and not backend_url.startswith('http'):
            backend_url = f"https://{backend_url}"
        
        # Preparar datos para el backend
        payload = {
            'rawMovements': movements,
            'scraperTaskId': task_data.get('id'),
            'userId': task_data.get('user_id'),
            'cuentas': cuentas
        }
        
        try:
            print(f"[INFO] Enviando {len(movements)} movimientos al backend...")
            print(f"[INFO] Backend URL: {backend_url}")
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{backend_url}/scraper/process-data",
                    json=payload,
                    headers={'Content-Type': 'application/json'}
                ) as response:
                    if response.status == 200 or response.status == 201:
                        result = await response.json()
                        
                        # Mostrar estadísticas detalladas
                        print("\n" + "="*60)
                        print(" PROCESO DE SCRAPING COMPLETADO EXITOSAMENTE")
                        print("="*60)
                        
                        if 'stats' in result:
                            stats = result['stats']
                            print(f" ESTADÍSTICAS DEL PROCESAMIENTO:")
                            print(f" Total procesados: {stats.get('total_procesados', 0)}")
                            print(f" Exitosos: {stats.get('exitosos', 0)}")
                            print(f" Errores: {stats.get('errores', 0)}")
                            
                            if 'por_categoria' in stats:
                                print(f" Distribución por categoría:")
                                for categoria, cantidad in stats['por_categoria'].items():
                                    print(f"    - {categoria}: {cantidad} movimientos")
                        
                        print(f"\n Movimientos guardados en la base de datos: {len(movements)}")
                        print(f" Fecha de procesamiento: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
                        print(f" ID de tarea: {task_data.get('id')}")
                        print("="*60)
                        if len(movements) > 0:
                            print("\n EJEMPLOS DE MOVIMIENTOS PROCESADOS:")
                            for i, mov in enumerate(movements[:5]):  # Mostrar hasta 5 ejemplos
                                print(f"  {i+1}. {mov.get('descripcion', 'Sin descripción')}")
                                print(f" Monto: ${mov.get('monto', 0):,.0f}")
                                print(f" Categoría: {mov.get('categoria_automatica', 'Sin categorizar')}")
                                print(f" Fecha: {mov.get('fecha', 'Sin fecha')}")
                                print()
                            
                            if len(movements) > 5:
                                print(f"     ... y {len(movements) - 5} movimientos más")
                        
                        print("\n El scraper ha finalizado correctamente!")
                        print(" Puedes revisar tus movimientos en la aplicación.")
                    else:
                        print(f"[ERROR] Error al enviar movimientos al backend: {response.status}")
                        error_text = await response.text()
                        print(f"[ERROR] Respuesta del servidor: {error_text}")
                        print("\nINFORMACIÓN DE RESPALDO:")
                        print(f" Total movimientos extraídos: {len(movements)}")
                        print(f" Guardados localmente en: results/banco_estado_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json")
                        print(" Los movimientos no se guardaron en la base de datos")
                        
        except Exception as e:
            print(f"[ERROR] Error al conectar con el backend: {e}")
            print("\n[INFO] INFORMACIÓN DE RESPALDO:")
            print(f" Total movimientos extraídos: {len(movements)}")
            print(f"Guardados localmente en: results/banco_estado_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json")
            print(" Los movimientos no se guardaron en la base de datos")
            print(f"Verifica que el backend esté ejecutándose en {backend_url}")
            
            # Mostrar resumen de categorización local
            if movements:
                categorias = {}
                for mov in movements:
                    cat = mov.get('categoria_automatica', 'Sin categorizar')
                    categorias[cat] = categorias.get(cat, 0) + 1
                
                print(f"\n RESUMEN DE CATEGORIZACIÓN LOCAL:")
                for categoria, cantidad in categorias.items():
                    print(f"  - {categoria}: {cantidad} movimientos")

    async def login_banco_estado(self, page, credentials: Credentials):
        """Inicia sesión en BancoEstado"""
        import sys
        try:
            print("Iniciando proceso de login...")
            sys.stdout.flush()
            print("Navegando a la página principal...")
            sys.stdout.flush()
            
            # Navegar a la página principal (AUMENTADO: 30s -> 45s)
            try:
                print("Navegando a bancoestado.cl...")
                sys.stdout.flush()
                await page.goto('https://www.bancoestado.cl/', timeout=45000)
                print("Esperando carga de página...")
                sys.stdout.flush()
                await page.wait_for_load_state("networkidle", timeout=20000)  # AUMENTADO: 10s -> 20s
                await page.wait_for_timeout(2000)  # AUMENTADO: 1s -> 2s
                print("[OK] Navegación a página principal exitosa")
                sys.stdout.flush()
            except Exception as nav_error:
                print(f"[ERROR] Falla en navegación inicial: {nav_error}")
                sys.stdout.flush()
                return False
            
            # Simular comportamiento inicial de exploración
            print(" Explorando la página...")
            # Scroll suave hacia abajo
            await page.evaluate("""
                window.scrollTo({
                    top: Math.random() * 300,
                    behavior: 'smooth'
                });
            """)
            await page.wait_for_timeout(2000)  # AUMENTADO: 1120ms -> 2000ms
            
            # Mover el mouse a algunos elementos aleatorios
            await page.evaluate("""
                () => {
                    const elements = Array.from(document.querySelectorAll('a, button, img')).slice(0, 5);
                    return elements.map(el => {
                        const rect = el.getBoundingClientRect();
                        return {x: rect.x + rect.width/2, y: rect.y + rect.height/2};
                    });
                }
            """)
            await self.simular_scroll_natural(page)
            await page.wait_for_timeout(1500)  # AUMENTADO: 1100ms -> 1500ms
            # Volver arriba suavemente
            await page.evaluate("""
                window.scrollTo({
                    top: 0,
                    behavior: 'smooth'
                });
            """)
            await page.wait_for_timeout(1000)  # AUMENTADO: 500ms -> 1000ms
            await self.cerrar_modal_infobar(page) 
            await self.cerrar_sidebar(page)
            await page.wait_for_timeout(2000)  # AUMENTADO: 1000ms -> 2000ms
            print(" Buscando botón 'Banca en Línea'...")
            sys.stdout.flush()
            try:
                await self.simular_movimiento_mouse_natural(page)
                await page.wait_for_timeout(random.randint(1000, 2000))  # AUMENTADO: 500-1100ms -> 1000-2000ms
                banca_button = None
                banca_selectors = [
                    "a[href*='login'] span:text('Banca en Línea')",
                    "a:has-text('Banca en Línea')",
                    "a[href*='login']"
                ]
                
                print(f"[INFO] Probando {len(banca_selectors)} selectores para 'Banca en Línea'")
                sys.stdout.flush()
                for i, selector in enumerate(banca_selectors):
                    try:
                        print(f"[INFO] Probando selector {i+1}: {selector}")
                        button = await page.wait_for_selector(selector, timeout=10000, state="visible")  # AUMENTADO: 5s -> 10s
                        if button:
                            banca_button = button
                            print(f"[OK] Botón 'Banca en Línea' encontrado con selector: {selector}")
                            break
                    except Exception as selector_error:
                        print(f"[INFO] Selector {i+1} falló: {selector_error}")
                        continue
                
                if not banca_button:
                    # Obtener información adicional sobre la página
                    current_url = page.url
                    page_title = await page.title()
                    print(f"[ERROR] No se encontró botón 'Banca en Línea'")
                    print(f"[ERROR] URL actual: {current_url}")
                    print(f"[ERROR] Título de página: {page_title}")
                    
                    # Buscar todos los enlaces para debugging
                    all_links = await page.locator("a").all()
                    print(f"[ERROR] Enlaces encontrados en la página: {len(all_links)}")
                    for link in all_links[:10]:  # Solo mostrar los primeros 10
                        try:
                            link_text = await link.text_content()
                            link_href = await link.get_attribute('href')
                            print(f"[ERROR] Link: '{link_text}' -> {link_href}")
                        except:
                            pass
                    
                    raise Exception("No se pudo encontrar el botón 'Banca en Línea'")
                
                print("[INFO] Haciendo hover y click en 'Banca en Línea'")
                await banca_button.hover()
                await page.wait_for_timeout(random.randint(800, 1500))  # AUMENTADO: 400-800ms -> 800-1500ms
                await self.simular_movimiento_mouse_natural(page)
                await banca_button.click()
                print("[OK] Click en 'Banca en Línea' realizado")
                await page.wait_for_timeout(2500)  # AUMENTADO: 1200ms -> 2500ms
                
            except Exception as e:
                print(f"ERROR: Error al hacer click en 'Banca en Línea': {str(e)}")
                return False
            await page.wait_for_load_state("networkidle", timeout=10000)  # AUMENTADO: 5s -> 10s
            await page.wait_for_timeout(2000)  # AUMENTADO: 1000ms -> 2000ms
            print(" Explorando página de login...")
            await self.simular_scroll_natural(page)
            await page.wait_for_timeout(random.randint(1200, 1800))  # AUMENTADO: 710-950ms -> 1200-1800ms
            await page.evaluate("""
                window.scrollTo({
                    top: 0,
                    behavior: 'smooth'
                });
            """)
            await page.wait_for_timeout(2000)  # AUMENTADO: 1210ms -> 2000ms
            # Buscar y llenar el campo RUT
            print(" Buscando campo RUT...")
            sys.stdout.flush()
            try:
                await page.wait_for_selector("#rut", timeout=10000)  # AUMENTADO: 5s -> 10s
                print("[OK] Campo RUT encontrado")
                sys.stdout.flush()
                await page.wait_for_timeout(500)  # AUMENTADO: 200ms -> 500ms
                await page.click("#rut")
                await page.evaluate("document.getElementById('rut').removeAttribute('readonly')")
                await page.wait_for_timeout(500)  # AUMENTADO: 210ms -> 500ms
                
                # Ingresar RUT simulando escritura humana
                print(" Ingresando RUT...")
                sys.stdout.flush()
                rut = credentials.rut.replace(".", "").replace("-", "").strip().lower()
                print(f"[INFO] RUT procesado: {rut}")
                sys.stdout.flush()
                await self.type_like_human(page, "#rut", rut, delay=300)  # AUMENTADO: 200ms -> 300ms
                await page.wait_for_timeout(random.randint(800, 1200))  # AUMENTADO: 500-600ms -> 800-1200ms
                print("[OK] RUT ingresado exitosamente")
                sys.stdout.flush()
                
            except Exception as rut_error:
                print(f"[ERROR] Error al ingresar RUT: {rut_error}")
                sys.stdout.flush()
                return False
            await page.evaluate("""
                (rut) => {
                    const input = document.getElementById('rut');
                    const start = input.selectionStart;
                    input.setSelectionRange(0, rut.length);
                    setTimeout(() => input.setSelectionRange(start, start), 200);
                }
            """, rut)
            await page.wait_for_timeout(random.randint(800, 1200))  # AUMENTADO: 500-600ms -> 800-1200ms
            
            # Buscar y llenar el campo de contraseña
            print(" Buscando campo de contraseña...")
            try:
                await page.click("#pass")
                print("[OK] Campo de contraseña encontrado")
                await page.evaluate("document.getElementById('pass').removeAttribute('readonly')")
                await page.wait_for_timeout(1500)  # AUMENTADO: 1000ms -> 1500ms
                
                print(" Ingresando contraseña...")
                await self.type_like_human(page, "#pass", credentials.password, delay=300)  # AUMENTADO: 200ms -> 300ms
                await page.wait_for_timeout(random.randint(1000, 1500))  # AUMENTADO: 500-950ms -> 1000-1500ms
                print("[OK] Contraseña ingresada exitosamente")
                
            except Exception as pass_error:
                print(f"[ERROR] Error al ingresar contraseña: {pass_error}")
                return False
            await page.evaluate("""
                () => {
                    const input = document.getElementById('pass');
                    const length = input.value.length;
                    input.setSelectionRange(0, length);
                    setTimeout(() => input.setSelectionRange(length, length), 200);
                }
            """)
            await page.wait_for_timeout(random.randint(1000, 1800))  # AUMENTADO: 600-1100ms -> 1000-1800ms
            await self.simular_comportamiento_humano(page)
            await self.espera_aleatoria(page)
            await page.wait_for_timeout(1000)  # AUMENTADO: 500ms -> 1000ms
            print(" Iniciando proceso de login...")
            sys.stdout.flush()
            try:
                await self.simular_movimiento_mouse_natural(page)
                login_button = None
                ingresar_selectors = [
                    "#btnLogin",
                    "button.msd-button--primary",
                    "button[type='submit']",
                    "button:has-text('Ingresar')",
                    ".msd-button.msd-button--primary",
                    "button.msd-button"
                ]
                
                print(f"[INFO] Buscando botón 'Ingresar' con {len(ingresar_selectors)} selectores")
                sys.stdout.flush()
                for i, selector in enumerate(ingresar_selectors):
                    try:
                        print(f"[INFO] Probando selector {i+1}: {selector}")
                        button = await page.wait_for_selector(selector, timeout=15000, state="visible")  # AUMENTADO: 10s -> 15s
                        if button:
                            login_button = button
                            print(f"[OK] Botón 'Ingresar' encontrado con selector: {selector}")
                            break
                    except Exception as selector_error:
                        print(f"[INFO] Selector {i+1} falló: {selector_error}")
                        continue
                
                if not login_button:
                    current_url = page.url
                    page_title = await page.title()
                    print(f"[ERROR] No se encontró botón 'Ingresar'")
                    print(f"[ERROR] URL actual: {current_url}")
                    print(f"[ERROR] Título de página: {page_title}")
                    all_buttons = await page.locator("button").all()
                    print(f"[ERROR] Botones encontrados en la página: {len(all_buttons)}")
                    for button in all_buttons[:10]:  # Solo mostrar los primeros 10
                        try:
                            button_text = await button.text_content()
                            button_type = await button.get_attribute('type')
                            button_class = await button.get_attribute('class')
                            print(f"[ERROR] Botón: '{button_text}' type='{button_type}' class='{button_class}'")
                        except:
                            pass
                    
                    raise Exception("No se pudo encontrar el botón 'Ingresar'")
                await login_button.wait_for_element_state("enabled")
                await page.wait_for_timeout(2000)  # AUMENTADO: 1250ms -> 2000ms
                await self.simular_movimiento_mouse_natural(page)
                await page.wait_for_timeout(random.randint(1000, 1500))  # AUMENTADO: 600-900ms -> 1000-1500ms
                await login_button.hover()
                await page.wait_for_timeout(random.randint(1000, 1500))  # AUMENTADO: 600-900ms -> 1000-1500ms
                success = False
                try:
                    await login_button.click(delay=random.randint(300, 600))  # AUMENTADO: 200-400ms -> 300-600ms
                    success = True
                except Exception as e:
                    print(f"Intento 1 fallido: {e}")
                if not success:
                    try:
                        await page.wait_for_timeout(2000)  # AUMENTADO: 1100ms -> 2000ms
                        await page.evaluate("""
                            (button) => {
                                button.click();
                                return true;
                            }
                        """, login_button)
                        success = True
                    except Exception as e:
                        print(f"Intento 2 fallido: {e}")
                if not success:
                    try:
                        await page.wait_for_timeout(1500)  # AUMENTADO: 700ms -> 1500ms
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
                
                print("[INFO] Click exitoso, esperando navegación...")
                sys.stdout.flush()
                await page.wait_for_timeout(5000)  # AUMENTADO: 3s -> 5s
                await page.wait_for_load_state("networkidle", timeout=25000)  # AUMENTADO: 15s -> 25s
                await page.wait_for_timeout(8000)  # AUMENTADO: 6s -> 8s
                print("[OK] Navegación completada")
                sys.stdout.flush()
            except Exception as e:
                print(f"ERROR: Error al intentar hacer click en el botón: {str(e)}")
                raise
            await page.wait_for_timeout(7000)  # AUMENTADO: 5s -> 7s
            modal_error = page.locator("text='ha ocurrido un error'")
            if await modal_error.count() > 0:
                print("[WARNING] Modal de error detectado tras login")
                raise Exception("ERROR: Error visible en pantalla después de iniciar sesión")
            await page.wait_for_timeout(9000)  # AUMENTADO: 7020ms -> 9000ms
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
            current_url = page.url
            print(f"URL actual: {current_url}")
            print("Explorando dashboard...")
            await self.simular_scroll_natural(page)
            await page.wait_for_timeout(random.randint(2000, 3000))  # AUMENTADO: 1500-2200ms -> 2000-3000ms
            print(" Verificando si el login fue exitoso...")
            sys.stdout.flush()
            try:
                success_selectors = [
                    "app-carrusel-productos-wrapper",
                    "app-card-producto",
                    "app-ultimos-movimientos-home",
                ]
                
                login_success = False
                print(f"[INFO] Verificando login con {len(success_selectors)} selectores")
                sys.stdout.flush()
                for i, selector in enumerate(success_selectors):
                    try:
                        print(f"[INFO] Buscando selector {i+1}: {selector}")
                        await page.wait_for_selector(selector, timeout=40000)  # AUMENTADO: 10s -> 15s
                        print(f"[OK] Login confirmado: Elemento {selector} encontrado")
                        login_success = True
                        break
                    except Exception as selector_error:
                        print(f"[INFO] Selector {i+1} no encontrado: {selector_error}")
                        continue
                        
                if not login_success:
                    print(f"[INFO] Verificando login por URL: {current_url}")
                    if any(x in current_url.lower() for x in ["personas/home", "personas/inicio", "#home", "dashboard"]):
                        print("[OK] Login confirmado por URL")
                        login_success = True
                    else:
                        print(f"[WARNING] URL no indica login exitoso: {current_url}")
                
                if not login_success:
                    print(f"[ERROR] Login fallido - URL inesperada: {current_url}")
                    sys.stdout.flush()
                    page_title = await page.title()
                    print(f"[ERROR] Título de página final: {page_title}")
                    sys.stdout.flush()
                    error_messages = await page.locator("text=/error|incorrecto|bloqueado|fallido/i").all()
                    if error_messages:
                        for msg in error_messages:
                            try:
                                error_text = await msg.text_content()
                                print(f"[ERROR] Mensaje de error: {error_text}")
                                sys.stdout.flush()
                            except:
                                pass
                    
                    print("[ERROR] Retornando False - Login fallido")
                    sys.stdout.flush()
                    return False
                    
                print("[OK] Login exitoso verificado")
                await self.simular_scroll_natural(page)
                await page.wait_for_timeout(random.randint(1000, 2000))  # AUMENTADO: 500-1000ms -> 1000-2000ms
                await page.evaluate("""
                    window.scrollTo({
                        top: 0,
                        behavior: 'smooth'
                    });
                """)
                await page.wait_for_timeout(6000)  # AUMENTADO: 4s -> 6s
                return True
                
            except Exception as e:
                print(f"ERROR: Error verificando login exitoso: {str(e)}")
                return False
        except Exception as e:
            print(f"ERROR: Error durante el login: {str(e)}")
            return False

async def main():
    try:
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
        scraper = BancoEstadoScraper(config)
        credentials = Credentials(
            rut="21.737.273-9",
            password="coom004"
        )
        
        async with async_playwright() as p:
            # Configurar el navegador según el entorno
            import os
            
            # Detectar si estamos en Railway
            is_railway = os.getenv('RAILWAY_ENVIRONMENT') == 'production'
            
            if is_railway:
                # Configuración para Railway (con display virtual)
                browser_args = [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-blink-features=AutomationControlled',
                    '--disable-web-security',
                    '--disable-extensions',
                    '--no-first-run',
                    '--display=:99'
                ]
                browser = await p.chromium.launch(
                    headless=False,  # Mantener interfaz gráfica
                    slow_mo=50,
                    args=browser_args
                )
            else:
                # Configuración local (normal)
                browser = await p.chromium.launch(
                    headless=False,
                    slow_mo=50
                )
            
            # Configurar el contexto
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                locale="es-CL",
                permissions=["geolocation"],
                geolocation=config.geolocation,
                timezone_id="America/Santiago",
                viewport={"width": 1920, "height": 1080}
            )
            
            # Configurar evasión de detección
            await context.add_init_script("""
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined
                });
            """)
            
            page = await context.new_page()
            print("\nIniciando login...")
            login_exitoso = await scraper.login_banco_estado(page, credentials)
            if not login_exitoso:
                print("ERROR: Login fallido")
                return
            print("\nExtrayendo saldos...")
            cuentas = await scraper.extract_cuentas(page)
            print("\nExtrayendo movimientos por cuenta...")
            for cuenta in cuentas:
                movimientos_cuenta = await scraper.extract_movimientos_cuenta(page, cuenta)
                cuenta['movimientos'] = movimientos_cuenta
            resultado = {
                "success": True,
                "fecha_extraccion": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "cuentas": cuentas
            }
            os.makedirs('results', exist_ok=True)
            scraper.guardar_en_json(
                f'results/banco_estado_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json',
                resultado
            )
            await page.wait_for_timeout(1010)
            await browser.close()
            
    except Exception as e:
        print(f"ERROR: Error durante la ejecución: {e}")
if __name__ == "__main__":
    asyncio.run(main()) 