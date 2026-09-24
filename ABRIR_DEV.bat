@echo off
setlocal
title RPG Canvas Studio - Desenvolvimento
call npm run tauri dev
if errorlevel 1 pause

