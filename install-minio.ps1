$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $projectRoot 'tools\Set-Utf8Console.ps1')
$configPath = Join-Path $projectRoot 'esoft.config.json'
$fallbackMinioPath = Join-Path $projectRoot 'tools\minio.exe'
$downloadUrl = 'https://dl.min.io/server/minio/release/windows-amd64/minio.exe'

if (-not (Test-Path $configPath)) {
  throw "Config file was not found: $configPath"
}

$config = Get-Content -Raw -Path $configPath -Encoding UTF8 | ConvertFrom-Json
$storage = $config.storage

if (-not $storage) {
  throw 'Storage config was not found in esoft.config.json'
}

$minioExe = if ($storage.executablePath) {
  [string]$storage.executablePath
} else {
  $fallbackMinioPath
}

$dataPath = if ($storage.dataPath) {
  [string]$storage.dataPath
} else {
  Join-Path $projectRoot 'minio'
}

$minioDirectory = Split-Path -Parent $minioExe

New-Item -ItemType Directory -Path $minioDirectory -Force | Out-Null
New-Item -ItemType Directory -Path $dataPath -Force | Out-Null

Write-Host 'Downloading MinIO for Esoft...' -ForegroundColor Cyan
Write-Host "Source: $downloadUrl"
Write-Host "Target: $minioExe"
Write-Host ''

Invoke-WebRequest -UseBasicParsing -Uri $downloadUrl -OutFile $minioExe

Write-Host ''
Write-Host 'MinIO installed.' -ForegroundColor Green
Write-Host "Executable: $minioExe"
Write-Host "Data path: $dataPath"
