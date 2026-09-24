@echo off
setlocal enabledelayedexpansion
title Compilar RPG Canvas Studio v1.1.0
cd /d "%~dp0"

echo ===============================================================
echo  RPG Canvas Studio - build para Windows
echo ===============================================================
echo.

set FALHOU=0

rem ---------------------------------------------------------------
rem 1) Node.js e npm
rem ---------------------------------------------------------------
where node >nul 2>nul
if errorlevel 1 (
  echo [ERRO] Node.js nao foi encontrado no PATH.
  echo        Instale em https://nodejs.org/ ^(versao LTS^) e abra um novo terminal.
  set FALHOU=1
) else (
  for /f "delims=" %%v in ('node --version') do echo [OK] Node.js %%v encontrado.
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERRO] npm nao foi encontrado no PATH. Reinstale o Node.js.
  set FALHOU=1
) else (
  for /f "delims=" %%v in ('npm --version') do echo [OK] npm %%v encontrado.
)

rem ---------------------------------------------------------------
rem 2) Rust e Cargo
rem ---------------------------------------------------------------
where cargo >nul 2>nul
if errorlevel 1 (
  echo [ERRO] Rust/Cargo nao foi encontrado no PATH.
  echo        Instale em https://rustup.rs/ e abra um novo terminal.
  set FALHOU=1
) else (
  for /f "delims=" %%v in ('cargo --version') do echo [OK] %%v encontrado.
)

if "%FALHOU%"=="1" goto :faltam_basicos

rem ---------------------------------------------------------------
rem 3) link.exe (linker do MSVC) - necessario para compilar o Cargo
rem    no Windows. Se nao estiver no PATH, procura o Visual Studio
rem    Build Tools via vswhere e carrega o ambiente automaticamente.
rem ---------------------------------------------------------------
where link.exe >nul 2>nul
if not errorlevel 1 (
  echo [OK] link.exe ja esta disponivel no PATH.
  goto :webview2
)

echo [AVISO] link.exe nao esta no PATH. Procurando o Visual Studio Build Tools...

set VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe
if not exist "%VSWHERE%" set VSWHERE=%ProgramFiles%\Microsoft Visual Studio\Installer\vswhere.exe

if not exist "%VSWHERE%" (
  echo [ERRO] vswhere.exe nao foi encontrado. O Visual Studio Build Tools
  echo        provavelmente nao esta instalado.
  goto :sem_build_tools
)

set VSINSTALL=
for /f "usebackq tokens=*" %%i in (`"%VSWHERE%" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath`) do (
  set VSINSTALL=%%i
)

if "%VSINSTALL%"=="" (
  echo [ERRO] Nenhuma instalacao do Visual Studio com o componente
  echo        "Ferramentas de build do C++" foi encontrada.
  goto :sem_build_tools
)

echo [OK] Visual Studio encontrado em: %VSINSTALL%

set VCVARS=%VSINSTALL%\VC\Auxiliary\Build\vcvars64.bat
if not exist "%VCVARS%" (
  echo [ERRO] vcvars64.bat nao foi encontrado dentro dessa instalacao.
  goto :sem_build_tools
)

echo Carregando o ambiente do MSVC ^(vcvars64.bat^)...
call "%VCVARS%" >nul
if errorlevel 1 (
  echo [ERRO] Falha ao executar vcvars64.bat.
  goto :sem_build_tools
)

where link.exe >nul 2>nul
if errorlevel 1 (
  echo [ERRO] link.exe continua indisponivel mesmo apos carregar o vcvars64.
  goto :sem_build_tools
)

echo [OK] link.exe carregado com sucesso a partir do Visual Studio Build Tools.
goto :webview2

:sem_build_tools
echo.
echo O Visual Studio Build Tools ^(com o workload "Desktop development with C++"^)
echo e obrigatorio para linkar o executavel do Tauri no Windows.
echo.
echo Instale executando este comando em um terminal com permissao de administrador:
echo.
echo   winget install --id Microsoft.VisualStudio.2022.BuildTools -e --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
echo.
echo Depois da instalacao, feche e reabra o terminal e execute este script novamente.
echo NENHUMA compilacao foi iniciada porque o linker esta ausente.
pause
exit /b 1

:webview2
rem ---------------------------------------------------------------
rem 4) WebView2 Runtime - necessario para RODAR o app (nao bloqueia
rem    o build, mas o usuario final precisa dele).
rem ---------------------------------------------------------------
reg query "HKLM\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" >nul 2>nul
if errorlevel 1 (
  reg query "HKLM\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" >nul 2>nul
)
if errorlevel 1 (
  echo [AVISO] O WebView2 Runtime nao foi detectado neste computador.
  echo         O Windows 11 e a maioria das instalacoes do Windows 10 ja o
  echo         possuem. Caso o aplicativo final nao abra, instale em:
  echo         https://developer.microsoft.com/microsoft-edge/webview2/
) else (
  echo [OK] WebView2 Runtime detectado.
)

echo.
echo ===============================================================
echo  Todas as dependencias de build foram verificadas. Iniciando...
echo ===============================================================
echo.

call npm install
if errorlevel 1 goto :erro

call npm test
if errorlevel 1 goto :erro

call npm run tauri build
if errorlevel 1 goto :erro

echo.
echo ===============================================================
echo  Build concluido com sucesso!
echo ===============================================================
echo.
echo Executavel portatil:
echo   %cd%\src-tauri\target\release\RPG Canvas Studio.exe
echo.
echo Instalador NSIS:
echo   %cd%\src-tauri\target\release\bundle\nsis\RPG Canvas Studio_1.1.0_x64-setup.exe
echo.
echo Instalador MSI:
echo   %cd%\src-tauri\target\release\bundle\msi\RPG Canvas Studio_1.1.0_x64_en-US.msi
echo.
pause
exit /b 0

:faltam_basicos
echo.
echo Corrija os itens marcados como [ERRO] acima e execute o script novamente.
pause
exit /b 1

:erro
echo.
echo O build falhou. Veja a mensagem de erro acima.
pause
exit /b 1
