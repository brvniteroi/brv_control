@echo off
rem Cria a tarefa do Windows que liga o agente sozinho quando o servidor liga (conta SYSTEM, sem janela).
rem Rodar UMA VEZ, com o botao direito > "Executar como administrador".
cd /d "%~dp0"
schtasks /Create /F /TN "BRV Control - Impressora" /SC ONSTART /RU SYSTEM /RL HIGHEST /TR "\"%~dp0rodar-agente.cmd\""
if errorlevel 1 (
  echo.
  echo Nao foi possivel criar a tarefa. Rode este arquivo como administrador.
  pause
  exit /b 1
)
schtasks /Run /TN "BRV Control - Impressora"
echo.
echo Tarefa criada e iniciada. Confira o arquivo agente.log nesta pasta e a tela Oficina do BRV Control.
pause
