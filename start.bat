@echo off
chcp 65001 >nul
title Zuzlowy Menedzer
cd /d "%~dp0"
where node >nul 2>nul || (echo Brak Node.js - zainstaluj ze strony https://nodejs.org ^(wersja 22.5 lub nowsza^) & pause & exit /b)
node --no-warnings tools\server.js --open
