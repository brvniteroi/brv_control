@echo off
rem Mantem o agente da impressora sempre rodando: se ele cair, volta em 10 segundos.
rem A tarefa do Windows "BRV Control - Impressora" chama este arquivo ao ligar o servidor.
cd /d "%~dp0"
:inicio
"C:\Program Files\nodejs\node.exe" agente.mjs
rem (ping em vez de timeout: na conta SYSTEM nao ha console e o timeout sai na hora)
ping -n 11 127.0.0.1 >nul
goto inicio
