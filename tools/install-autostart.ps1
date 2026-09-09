# Регистрирует задачу планировщика "Health Server" (без прав администратора):
# запускает сервер при входе в Windows без окна и перезапускает, если он упал.
# Запуск:  powershell -ExecutionPolicy Bypass -File tools\install-autostart.ps1
# Удалить: Unregister-ScheduledTask -TaskName 'Health Server' -Confirm:$false

$root = Split-Path -Parent $PSScriptRoot
$vbs = Join-Path $root 'tools\start-hidden.vbs'

$action = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument "`"$vbs`"" -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName 'Health Server' -Action $action -Trigger $trigger -Settings $settings -Description 'Локальный сервер базы здоровья (http://localhost:3010)' -Force | Out-Null

Write-Host 'Задача "Health Server" создана: сервер будет запускаться при входе в Windows.'
Write-Host 'Запустить сейчас:  Start-ScheduledTask -TaskName "Health Server"'
