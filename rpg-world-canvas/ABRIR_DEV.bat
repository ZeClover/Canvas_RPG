@echo off
setlocal
title RPG World Canvas - Desenvolvimento
call npm run tauri dev
if errorlevel 1 pause
