# FinanTrack

## 1. Clonación del Proyecto

- Clona el repositorio del proyecto:
   ```git clone https://github.com/CookieBlossom/FinanTrack.git ```
- Navega al proyecto
    ``` cd Finantrack ```
- Verifica git
    ``` git status ```
- Muevete a la rama de desarrollo
    ``` git switch development ```

## 2. Descarga de Archivos (PostgreSQL)

-  Descarga PostgreSQL version 17.4 https://www.enterprisedb.com/downloads/postgres-postgresql-downloads
-  Durante la instalacion deja todo predeterminado, incluso el puerto "5432"
- Si se abre stack builder solo cierra el programa una vez instalado todo.
- Reinicia tu PC para que la instalacion se actualice.
- Anota la constrasena que le des al usuario de "postgres", ya que deberas modificarla posteriormente en el archivo backend/.env
## 3. Descarga de Archivos (DOCKER)

- Descarga Docker Desktop https://www.docker.com/products/docker-desktop/ (no es necesario escoger ningun plan, solo desliza hasta que salga el boton de descargar)
- Reinicia tu PC si es necesario
- abre docker-desktop e ve a la seccion de "extensiones", donde buscas "Pg" y descargas la que diga "Open Source management tool for PostgreSQL"
- una vez que se instale la extension, tienes que setear una master password, esta debes guardarla por que sera tu autenticador de pgAdmin
- creas un nuevo server, lo llamas postgres, y en conexion colocas, host/address: host.docker.internal, port: 5432 (el predeterminado), username: postgres, password: (tu masterPassword)

## 4. Instalacion de dependencias
- en la carpeta raiz de "finantrack" verifica ``` node -v ``` y ``` npm -v ``` 
- en la carpeta "finantrack/backend" debes correr el comando ``` npm install ```
- en la carpeta "finantrack/frontend" debes correr el comando ``` npm install ```
- en la carpeta "finantrack/backend/.env" debes cambiar ```DB_PASSWORD=2004``` por tu contraseña que le hayas puesto a postgres en el paso 2

## 5. Ejecucion del Proyecto
# BACKEND
- Desde la carpeta "finantrack/backend" en la TERMINAL ejecuta ``` npm start ```
- Esto dejara corriendo el backend en "https://localhost:3000"
# FRONTED
- Desde la carpeta "finantrack/fronted" en la TERMINAL ejecuta ``` ng serve ```
- Esto dejara corriendo el fronted en "https://localhost:4200"

## 6. Comandos comunes a utilizar
**GIT**

- ```git status``` (comprueba que cambios has hecho)
- ```git checkout -b 'nombre-de-nueva-rama'``` (crea una nueva rama)
- ```git switch 'nombre-de-la-rama'``` (cambias de una rama a otra)
- ```git add .'``` (agregas los cambios realizados para ser guardados)
- ```git commit -am 'mensaje'``` (guardas los cambios realizados)
- ```git push -u origin 'nombre-de-la-rama'``` (subes los cambios)

**ANGULAR**

- ``` ng serve ``` (para levantar el fronted y dejarlo activo)
- ``` ng build ``` (para compilar el fronted y se que actualicen todos los cambios)
- ``` ng generate component component/nombre ``` (Crea un componente)
- ``` ng generate service service/nombre ``` (Crea un servicio)
- ``` ng generate module modules/nombre ``` (Crea un Modulo)
- ``` ng generate interface interface/nombre ``` (Crea un interfaz)
- ``` ng generate class class/nombre ``` (Crea una clase de typescript)
- ``` ng lint ``` (Analiza el codigo para encontrar errores de tipografia, algun espacio, tab, identacion, etc)