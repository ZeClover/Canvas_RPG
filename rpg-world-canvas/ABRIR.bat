@echo off
setlocal
title RPG World Canvas v0.9.0
cd /d "%~dp0"

set EXE=%cd%\src-tauri\target\release\RPG World Canvas.exe

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
