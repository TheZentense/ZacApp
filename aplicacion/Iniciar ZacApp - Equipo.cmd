@echo off
setlocal
chcp 65001 >nul
title ZacApp - Iniciador para el equipo
pushd "%~dp0"

rem Permite que Node use los certificados confiables instalados en Windows.
if defined NODE_OPTIONS (
  set "NODE_OPTIONS=%NODE_OPTIONS% --use-system-ca"
) else (
  set "NODE_OPTIONS=--use-system-ca"
)

set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
set "NPM_CMD=%ProgramFiles%\nodejs\npm.cmd"

if not exist "%NODE_EXE%" (
  for /f "delims=" %%I in ('where node.exe 2^>nul') do if not defined NODE_FOUND set "NODE_FOUND=%%I"
  if defined NODE_FOUND set "NODE_EXE=%NODE_FOUND%"
)

if not exist "%NPM_CMD%" (
  for /f "delims=" %%I in ('where npm.cmd 2^>nul') do if not defined NPM_FOUND set "NPM_FOUND=%%I"
  if defined NPM_FOUND set "NPM_CMD=%NPM_FOUND%"
)

if not exist "%NODE_EXE%" (
  echo.
  echo [ERROR] Node.js no esta instalado o no se encuentra en el sistema.
  echo Se requiere Node.js LTS para ejecutar ZacApp.
  echo.
  pause
  popd
  exit /b 1
)

if not exist "%NPM_CMD%" (
  echo.
  echo [ERROR] No se encontro npm junto a Node.js.
  echo Se recomienda reparar la instalacion de Node.js.
  echo.
  pause
  popd
  exit /b 1
)

if not exist "package.json" (
  echo.
  echo [ERROR] El iniciador debe permanecer dentro de la carpeta aplicacion.
  echo No se encontro el archivo package.json.
  echo.
  pause
  popd
  exit /b 1
)

for /f "delims=" %%V in ('"%NODE_EXE%" --version') do set "NODE_VERSION=%%V"
echo Node.js detectado: %NODE_VERSION%

if not exist "node_modules" (
  echo.
  echo Las dependencias de ZacApp no estan instaladas en este equipo.
  choice /C SN /N /M "¿Deseas instalarlas ahora? [S/N]: "
  if errorlevel 2 goto :end
  echo.
  call "%NPM_CMD%" install
  if errorlevel 1 (
    echo.
    echo [ERROR] No se pudieron instalar las dependencias.
    echo Comprueba la conexion a Internet e intentalo nuevamente.
    echo.
    pause
    goto :end
  )
)

:menu
cls
echo ==================================================
echo                  ZACAPP
echo           INICIADOR PARA EL EQUIPO
echo ==================================================
echo.
echo  [1] Expo Go mediante red local
echo  [2] Navegador web
echo  [3] Expo Go mediante tunel
echo  [4] Instalar o actualizar dependencias
echo  [5] Verificar TypeScript
echo  [6] Salir
echo.
choice /C 123456 /N /M "Selecciona una opcion [1-6]: "

if errorlevel 6 goto :end
if errorlevel 5 goto :typecheck
if errorlevel 4 goto :install
if errorlevel 3 goto :tunnel
if errorlevel 2 goto :web
if errorlevel 1 goto :expo

:expo
cls
echo Iniciando ZacApp para Expo Go mediante red local...
echo El telefono y la computadora deben usar la misma red.
echo Para detener el servidor presiona Ctrl+C.
echo.
call "%NPM_CMD%" start
goto :menu

:web
cls
echo Iniciando ZacApp en el navegador...
echo Para detener el servidor presiona Ctrl+C.
echo.
call "%NPM_CMD%" run web
goto :menu

:tunnel
cls
echo Iniciando ZacApp mediante tunel...
echo Esta opcion evita bloqueos de la red local o del firewall.
echo Para detener el servidor presiona Ctrl+C.
echo.
call "%NPM_CMD%" start -- --tunnel
goto :menu

:install
cls
echo Instalando o actualizando dependencias...
echo.
call "%NPM_CMD%" install
echo.
pause
goto :menu

:typecheck
cls
echo Verificando el proyecto con TypeScript...
echo.
call "%NPM_CMD%" run typecheck
echo.
pause
goto :menu

:end
popd
endlocal
exit /b 0
