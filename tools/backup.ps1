# Резервная копия: папка data (база + загруженные файлы) -> zip с датой. Хранит последние 30 копий.
# Куда: %OneDrive%\HealthBackups, если OneDrive настроен, иначе Documents\HealthBackups.
$root = Split-Path -Parent $PSScriptRoot
$data = Join-Path $root 'data'
if (-not (Test-Path $data)) { Write-Host 'Папки data нет — нечего копировать'; exit 0 }

$dest = if ($env:OneDrive -and (Test-Path $env:OneDrive)) { Join-Path $env:OneDrive 'HealthBackups' } else { Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'HealthBackups' }
New-Item -ItemType Directory -Force -Path $dest | Out-Null

# Снимок базы через SQLite backup API — корректно даже при работающем сервере (WAL).
$snap = Join-Path $env:TEMP 'health-snapshot'
if (Test-Path $snap) { Remove-Item -Recurse -Force $snap }
New-Item -ItemType Directory -Force -Path $snap | Out-Null
& node --disable-warning=ExperimentalWarning (Join-Path $PSScriptRoot 'snapshot.js') (Join-Path $data 'health.db') (Join-Path $snap 'health.db')
if (-not (Test-Path (Join-Path $snap 'health.db'))) { Write-Error 'Не удалось сделать снимок базы'; exit 1 }
if (Test-Path (Join-Path $data 'uploads')) { Copy-Item -Recurse (Join-Path $data 'uploads') (Join-Path $snap 'uploads') }

$zip = Join-Path $dest ("health-" + (Get-Date -Format 'yyyy-MM-dd_HH-mm') + '.zip')
Compress-Archive -Path (Join-Path $snap '*') -DestinationPath $zip -Force
Remove-Item -Recurse -Force $snap
Get-ChildItem $dest -Filter 'health-*.zip' | Sort-Object LastWriteTime -Descending | Select-Object -Skip 30 | Remove-Item -Force
Write-Host "Копия: $zip"
