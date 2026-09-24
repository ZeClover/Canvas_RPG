@echo off
setlocal
title Instalar RPG Canvas Studio
where node >nul 2>nul || (
  echo Node.js nao foi encontrado. Instale em https://nodejs.org/
  pause
  exit /b 1
)
where cargo >nul 2>nul || (
  echo Rust nao foi encontrado. Instale em https://rustup.rs/
  pause
  exit /b 1
)
call npm install
if errorlevel 1 goto :erro
echo.
echo Instalacao concluida.
pause
exit /b 0
:erro
echo.
echo A instalacao falhou. Veja a mensagem acima.
pause
exit /b 1

