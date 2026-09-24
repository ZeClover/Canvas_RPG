@echo off
setlocal
title RPG Canvas Studio v1.1.0
cd /d "%~dp0"

set EXE=%cd%\src-tauri\target\release\RPG Canvas Studio.exe

if not exist "%EXE%" (
  echo O executavel ainda nao foi compilado neste computador.
  echo Caminho esperado:
  echo   %EXE%
  echo.
  echo Execute BUILD_WINDOWS.bat primeiro para gerar o aplicativo.
  pause
  exit /b 1
)

start "" "%EXE%"
