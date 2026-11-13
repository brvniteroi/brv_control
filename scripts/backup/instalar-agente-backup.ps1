# Registra a tarefa "BRV Control - Agente de Backup" no Agendador de Tarefas do PC da empresa.
# O vigia (agente-backup.mjs) fica rodando o tempo todo e atende o botão "Fazer backup agora" do Dashboard.
# Sobe quando o usuário entra no Windows, sem janela, sem limite de tempo, e reinicia sozinho se cair.
# Uso (PowerShell, na pasta do projeto):  powershell -ExecutionPolicy Bypass -File scripts\backup\instalar-agente-backup.ps1
$ErrorActionPreference = 'Stop'
$nome = 'BRV Control - Agente de Backup'
$node = (Get-Command node).Source
$raiz = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path

$acao = New-ScheduledTaskAction -Execute 'powershell.exe' `
  -Argument "-NoProfile -WindowStyle Hidden -Command `"& '$node' scripts\backup\agente-backup.mjs`"" `
  -WorkingDirectory $raiz
$gatilho = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$config = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 99 `
  -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew -StartWhenAvailable `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

Register-ScheduledTask -TaskName $nome -Action $acao -Trigger $gatilho -Settings $config -Force | Out-Null
Start-ScheduledTask -TaskName $nome
Write-Host "Tarefa '$nome' registrada e iniciada. Log do vigia: D:\backups-brv\agente-backup.log"
