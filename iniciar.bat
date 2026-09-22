@echo off
chcp 65001 >nul
title Roteiro Roma
cd /d "%~dp0"
start "" http://localhost:5173
node servidor.mjs
pause
