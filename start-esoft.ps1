$ErrorActionPreference = 'Stop'

$projectRoot = 'C:\Users\alex\Documents\New project\Esoft'
$backendPort = 3000
$frontendPort = 5173
$frontendUrl = "http://127.0.0.1:$frontendPort/"

function Test-PortListening {
  param([int] $Port)

  $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -First 1

  return $null -ne $connection
}

function Wait-HttpReady {
  param(
    [string] $Url,
    [int] $TimeoutSeconds = 60
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

  while ((Get-Date) -lt $deadline) {
    try {
      Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 3 | Out-Null
      return $true
    } catch {
      Start-Sleep -Seconds 2
    }
  }

  return $false
}

Set-Location $projectRoot

try {
  docker info | Out-Null
} catch {
  $dockerDesktop = 'C:\Program Files\Docker\Docker\Docker Desktop.exe'

  if (Test-Path $dockerDesktop) {
    Start-Process -FilePath $dockerDesktop
    Start-Sleep -Seconds 25
  }
}

docker compose up -d postgres

if (-not (Test-PortListening -Port $backendPort)) {
  Start-Process powershell.exe -WindowStyle Minimized -WorkingDirectory "$projectRoot\backend" -ArgumentList @(
    '-NoExit',
    '-ExecutionPolicy', 'Bypass',
    '-Command', 'npm run start:dev'
  )
}

if (-not (Test-PortListening -Port $frontendPort)) {
  Start-Process powershell.exe -WindowStyle Minimized -WorkingDirectory "$projectRoot\frontend" -ArgumentList @(
    '-NoExit',
    '-ExecutionPolicy', 'Bypass',
    '-Command', 'npm run dev -- --host 127.0.0.1'
  )
}

Wait-HttpReady -Url $frontendUrl -TimeoutSeconds 60 | Out-Null
Start-Process $frontendUrl
