@echo off
setlocal
title Instalar RPG World Canvas v0.7.0
cd /d "%~dp0"

echo ===============================================================
echo  RPG World Canvas - instalacao das dependencias
echo ===============================================================
echo.

set FALHOU=0

where node >nul 2>nul
if errorlevel 1 (
  echo [ERRO] Node.js nao foi encontrado. Instale em https://nodejs.org/
  set FALHOU=1
) else (
  for /f "delims=" %%v in ('node --version') do echo [OK] Node.js %%v
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERRO] npm nao foi encontrado. Reinstale o Node.js.
  set FALHOU=1
)

where cargo >nul 2>nul
if errorlevel 1 (
  echo [ERRO] Rust nao foi encontrado. Instale em https://rustup.rs/
  set FALHOU=1
) else (
  for /f "delims=" %%v in ('cargo --version') do echo [OK] %%v
)

if "%FALHOU%"=="1" (
  echo.
  echo Corrija os itens acima, abra um novo terminal e execute este
  echo script novamente.
  pause
  exit /b 1
)

call npm install
if errorlevel 1 goto :erro

echo.
echo ===============================================================
echo  Instalacao concluida.
echo ===============================================================
echo.
echo Proximo passo: execute BUILD_WINDOWS.bat para compilar o aplicativo
echo ^(ele verifica o linker do Visual Studio e o WebView2 automaticamente^).
pause
exit /b 0

:erro
echo.
echo A instalacao falhou. Veja a mensagem acima.
pause
exit /b 1
