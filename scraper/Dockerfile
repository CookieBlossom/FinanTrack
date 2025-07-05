FROM python:3.11-slim

# Instalar dependencias del sistema necesarias para Chrome y xvfb
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    unzip \
    curl \
    xvfb \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    libxss1 \
    procps \
    && rm -rf /var/lib/apt/lists/*

# Instalar Google Chrome
RUN wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

# Configurar directorio de trabajo
WORKDIR /app

# Copiar requirements y instalar dependencias Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código fuente
COPY . .

# Instalar Playwright y browsers
RUN pip install playwright
RUN playwright install chromium
RUN playwright install-deps

# Variables de entorno
ENV PYTHONUNBUFFERED=1
ENV DISPLAY=:99
ENV RAILWAY_ENVIRONMENT=production

# Crear script de inicio
RUN echo '#!/bin/bash\n\
# Limpiar displays existentes\n\
rm -f /tmp/.X99-lock\n\
pkill -f "Xvfb :99" || true\n\
\n\
# Iniciar Xvfb en background\n\
Xvfb :99 -screen 0 1920x1080x24 -ac +extension GLX +render -noreset &\n\
\n\
# Esperar a que Xvfb esté listo\n\
sleep 2\n\
\n\
# Ejecutar el scraper\n\
python banco_estado_integration.py\n\
' > /app/start.sh && chmod +x /app/start.sh

# Exponer puerto
EXPOSE 8000

# Comando para iniciar
CMD ["/app/start.sh"]