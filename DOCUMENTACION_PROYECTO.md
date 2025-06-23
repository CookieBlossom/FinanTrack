# 📋 Documentación del Proyecto FinanTrack

## 🚀 Recordatorio para Desarrollo

### Configuración para pasar a desarrollo:

1. **Comentar inicialización de esquema en el backend**
   - Archivo: `backend/src/config/database/connection.ts`
   - Comenta la parte donde se ejecuta el archivo `schema.sql` para evitar que se reinicialice la base de datos cada vez que levantas el servidor en desarrollo.
   - Ejemplo:
     ```ts
     // const schema = fs.readFileSync(schemaPath, 'utf8');
     // await client.query(schema);
     ```

2. **Descomentar uso de environment en el frontend**
   - Asegúrate de que el frontend Angular utilice el archivo `environment.ts` (o el correspondiente a desarrollo) para las variables de entorno y endpoints.
   - Si tienes líneas comentadas relacionadas con `environment`, descoméntalas para que tome la configuración correcta.

---

## 📁 Estructura General del Proyecto

### **backend/**
- **Propósito:** API principal, lógica de negocio, conexión a base de datos y endpoints.
- **Carpetas principales:**
  - `src/`: Código fuente del backend.
    - `config/`: Configuración general y de base de datos.
    - `controllers/`: Controladores de rutas/endpoints.
    - `interfaces/`: Definición de interfaces TypeScript.
    - `middlewares/`: Middlewares de Express (autenticación, permisos, etc).
    - `routes/`: Definición de rutas de la API.
    - `services/`: Lógica de negocio y acceso a datos.
    - `utils/`: Utilidades y helpers.
    - `validators/`: Validaciones de datos.
  - `package.json`, `tsconfig.json`, etc.: Configuración del proyecto Node.js/TypeScript.

### **frontend/**
- **Propósito:** Aplicación web Angular, interfaz de usuario.
- **Carpetas principales:**
  - `src/`: Código fuente Angular.
    - `app/`: Componentes, módulos, servicios y utilidades de la app.
    - `assets/`: Imágenes y recursos estáticos.
    - `environments/`: Archivos de configuración de entorno (`environment.ts`).
    - `styles.css`: Estilos globales.
  - `angular.json`, `package.json`, etc.: Configuración del proyecto Angular.

### **scraper/**
- **Propósito:** Módulo independiente para scraping de datos bancarios.
- **Carpetas principales:**
  - `models/`: Modelos de datos para el scraper.
  - `results/`: Resultados y logs de scraping.
  - `sites/`: Implementaciones específicas para cada banco.
  - `test/`: Pruebas del scraper.
  - `utils/`: Utilidades para el scraper.
  - `requirements.txt`: Dependencias de Python.

---

## 📂 Estructura Detallada del Frontend (`frontend/src/`)

### **📁 app/** - Código principal de la aplicación Angular

#### **📁 modules/** - Módulos funcionales de la aplicación
- **`about-company/`** - Página de información sobre la empresa
- **`analytics/`** - Módulo de análisis y reportes financieros
- **`card/`** - Gestión de tarjetas de crédito/débito
  - `add-card-dialog/` - Diálogo para agregar tarjetas
  - `delete-card-dialog/` - Diálogo para eliminar tarjetas
  - `edit-card-dialog/` - Diálogo para editar tarjetas
- **`categories/`** - Gestión de categorías de gastos
- **`config/`** - Configuración de la aplicación
- **`condiciones/`** - Términos y condiciones (PRONTO A ELIMINAR, NO SE UTILIZA)
- **`dashboard/`** - Panel principal con gráficos y resumen financiero
- **`dialog/`** - Componentes de diálogo reutilizables
- **`forgot-password/`** - Recuperación de contraseña
- **`help/`** - Página de ayuda y soporte (NO SE UTILIZA)
- **`home/`** - Página de inicio
- **`layout/`** - Componentes de estructura de la aplicación
- **`login/`** - Autenticación de usuarios
- **`movements/`** - Gestión de movimientos financieros
  - `add-cash/` - Agregar efectivo
  - `add-movement/` - Agregar movimientos
  - `upload-statement/` - Carga de estados de cuenta
- **`plans/`** - Gestión de planes de suscripción
- **`profile/`** - Perfil de usuario
  - `change-password/` - Cambio de contraseña
- **`register/`** - Registro de nuevos usuarios
  - `terms-conditions-dialog/` - Diálogo de términos y condiciones
- **`reset-password/`** - Restablecimiento de contraseña
- **`upcoming-transactions/`** - Transacciones futuras
  - `add-upcoming-movement/` - Agregar transacciones futuras

#### **📁 shared/** - Componentes y utilidades compartidas
- **`components/`** - Componentes reutilizables
  - `current-plan/` - Mostrar plan actual del usuario
  - `form-template/` - Plantilla de formularios
  - `layout/` - Componentes de estructura
  - `limit-alert/` - Alertas de límites
  - `limit-notification/` - Notificaciones de límites
  - `limit-notifications/` - Gestión de notificaciones
  - `plan-usage/` - Uso del plan actual
  - `sidebar/` - Barra lateral de navegación
  - `toolbar/` - Barra de herramientas
- **`directives/`** - Directivas personalizadas
  - `feature-control.directive.ts` - Control de características por plan
- **`services/`** - Servicios compartidos
  - `plan-notifications.service.ts` - Notificaciones de plan
  - `plan-utils.service.ts` - Utilidades de plan
- **`styles/`** - Estilos compartidos
  - `form-styles.css` - Estilos de formularios
- **`utils/`** - Utilidades compartidas
  - `auth.guard.ts` - Guard de autenticación

#### **📁 services/** - Servicios de la aplicación
- **`analytics.service.ts`** - Servicios de análisis y reportes
- **`auth.service.ts`** - Autenticación y autorización
- **`auth-token.service.ts`** - Gestión de tokens de autenticación
- **`card.service.ts`** - Gestión de tarjetas
- **`category.service.ts`** - Gestión de categorías
- **`dashboard.service.ts`** - Datos del dashboard
- **`database.service.ts`** - Servicios de base de datos
- **`feature-control.service.ts`** - Control de características por plan
- **`limit-notifications.service.ts`** - Notificaciones de límites
- **`movement.service.ts`** - Gestión de movimientos
- **`plan.service.ts`** - Gestión de planes
- **`plan-limits.service.ts`** - Límites de planes
- **`projected-movement.service.ts`** - Movimientos proyectados
- **`scraper.service.ts`** - Servicios de scraping bancario
- **`stripe.service.ts`** - Integración con Stripe
- **`user.service.ts`** - Gestión de usuarios

#### **📁 models/** - Modelos de datos TypeScript
- **`card.model.ts`** - Modelo de tarjeta
- **`category.model.ts`** - Modelo de categoría
- **`movement.model.ts`** - Modelo de movimiento
- **`plan.model.ts`** - Modelo de plan
- **`projected-movement.model.ts`** - Modelo de movimiento proyectado
- **`scraper.model.ts`** - Modelo de scraper
- **`stripe.model.ts`** - Modelo de Stripe
- **`user.model.ts`** - Modelo de usuario

#### **📁 guards/** - Guards de Angular
- **`plan.guard.ts`** - Guard para verificar plan del usuario

#### **📁 interceptors/** - Interceptores HTTP
- **`auth.interceptor.ts`** - Interceptor de autenticación

#### **📁 utils/** - Utilidades generales
- **`error-state.matcher.ts`** - Matcher de estado de error
- **`rut.utils.ts`** - Utilidades para RUT chileno

#### **Archivos principales:**
- **`app.component.ts/html/css`** - Componente raíz de la aplicación
- **`app.config.ts`** - Configuración de la aplicación
- **`app.module.ts`** - Módulo principal
- **`app.routes.ts`** - Configuración de rutas

### **📁 assets/** - Recursos estáticos
- **`images/`** - Imágenes de la aplicación
  - `imagenBienvenidos.jpg` - Imagen de bienvenida
  - `logoBlanco.png` - Logo en blanco
  - `logoBlancoNegro.png` - Logo en blanco y negro
  - `logoGrisFondo.png` - Logo con fondo gris
  - `logoVino.png` - Logo en color vino
- **`icons/`** - Iconos de la aplicación

### **📁 environments/** - Configuración de entornos
- **`environment.ts`** - Variables de entorno para desarrollo

### **Archivos principales:**
- **`index.html`** - Archivo HTML principal
- **`main.ts`** - Punto de entrada de la aplicación
- **`styles.css`** - Estilos globales de la aplicación

---

## 🔧 Tecnologías Utilizadas

### **Frontend:**
- **Angular 17** - Framework principal
- **TypeScript** - Lenguaje de programación
- **Angular Material** - Componentes de UI
- **AG Grid** - Tablas de datos
- **NGX Charts** - Gráficos y visualizaciones
- **RxJS** - Programación reactiva

### **Backend:**
- **Node.js** - Runtime de JavaScript
- **Express.js** - Framework web
- **TypeScript** - Lenguaje de programación
- **PostgreSQL** - Base de datos
- **Stripe** - Procesamiento de pagos
- **Redis** - Cache y sesiones

### **Scraper:**
- **Python** - Lenguaje de programación
- **Selenium** - Automatización web
- **Beautiful Soup** - Parsing HTML

---

## 🚀 Comandos Útiles

### **Frontend:**
```bash
# Instalar dependencias
npm install

# Servidor de desarrollo
ng serve

# Build de producción
ng build --configuration production

# Ejecutar tests
ng test
```

### **Backend:**
```bash
# Instalar dependencias
npm install

# Servidor de desarrollo
npm run dev

# Build
npm run build

# Ejecutar en producción
npm start
```

### **Scraper:**
```bash
# Instalar dependencias
pip install -r requirements.txt

# Ejecutar scraper
python scraper/main.py
```

---

## 📝 Notas Importantes

1. **Variables de entorno:** Asegúrate de configurar correctamente las variables de entorno en ambos proyectos.
2. **Base de datos:** El esquema se inicializa automáticamente en desarrollo, pero debe comentarse para evitar reinicializaciones.
3. **CORS:** Configurado para permitir comunicación entre frontend y backend.
4. **Autenticación:** JWT tokens para manejo de sesiones.
5. **Planes:** Sistema de suscripciones con Stripe integrado.
6. **Scraping:** Módulo independiente para obtener datos bancarios automáticamente.

---

*Documentación actualizada: [Fecha]* 