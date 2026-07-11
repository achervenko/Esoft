$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$configPath = Join-Path $projectRoot 'esoft.config.json'

if (-not (Test-Path $configPath)) {
  throw "Config file was not found: $configPath"
}

$config = Get-Content -Raw -Path $configPath -Encoding UTF8 | ConvertFrom-Json
$storage = $config.storage

if (-not $storage) {
  throw 'Storage config was not found in esoft.config.json'
}

$minioExe = [string]$storage.executablePath
$dataPath = [string]$storage.dataPath
$rootUser = [string]$storage.accessKey
$rootPassword = [string]$storage.secretKey

if (-not (Test-Path -LiteralPath $minioExe)) {
  throw "MinIO executable was not found: $minioExe. Run npm run install:minio first."
}

New-Item -ItemType Directory -Path $dataPath -Force | Out-Null

$env:MINIO_ROOT_USER = $rootUser
$env:MINIO_ROOT_PASSWORD = $rootPassword

Write-Host 'Starting MinIO for Esoft...' -ForegroundColor Cyan
Write-Host "Storage path: $dataPath"
Write-Host 'API: http://127.0.0.1:9000'
Write-Host 'Console: http://127.0.0.1:9001'
Write-Host ''

& $minioExe server $dataPath --console-address ':9001'
