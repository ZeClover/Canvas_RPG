@echo off
setlocal
title Compilar RPG Canvas Studio
call npm install
if errorlevel 1 goto :erro
call npm test
if errorlevel 1 goto :erro
call npm run tauri build
if errorlevel 1 goto :erro
echo.
echo Build concluido. Veja src-tauri\target\release\bundle\
pause
exit /b 0
:erro
echo.
echo O build falhou. Veja a mensagem acima.
pause
exit /b 1

