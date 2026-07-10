$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendPort = 3000
$frontendPort = 5173
$logsDir = Join-Path $projectRoot 'logs'
$launcherLog = Join-Path $logsDir 'simple-launcher.log'

function Write-LaunchLog {
  param([string] $Message)

  $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
  Add-Content -Path $launcherLog -Value "[$timestamp] $Message" -Encoding UTF8
}

function Stop-ProcessOnPort {
  param([int] $Port)

  Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique |
    Where-Object { $_ -and $_ -ne $PID } |
    ForEach-Object {
      Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
    }
}

function Stop-OldEsoftProcesses {
  Stop-ProcessOnPort -Port $backendPort
  Stop-ProcessOnPort -Port $frontendPort

  $escapedRoot = [regex]::Escape($projectRoot)

  Get-CimInstance Win32_Process |
    Where-Object {
      $_.CommandLine -match $escapedRoot -and
      (
        $_.CommandLine -match 'vite' -or
        $_.CommandLine -match 'nest start' -or
        $_.CommandLine -match 'start:dev' -or
        $_.CommandLine -match 'dist\\main'
      )
    } |
    Select-Object -ExpandProperty ProcessId -Unique |
    Where-Object { $_ -and $_ -ne $PID } |
    ForEach-Object {
      Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
    }

  Start-Sleep -Seconds 2
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

function Get-LocalLanIp {
  $physicalAdapters = @(Get-NetAdapter -ErrorAction SilentlyContinue |
    Where-Object {
      $_.Status -eq 'Up' -and
      $_.Virtual -eq $false -and
      $_.Name -notmatch 'Bluetooth'
    } |
    Select-Object -ExpandProperty ifIndex)

  $addresses = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object {
      $physicalAdapters -contains $_.InterfaceIndex -and
      $_.IPAddress -notlike '127.*' -and
      $_.IPAddress -notlike '169.254.*' -and
      $_.PrefixOrigin -ne 'WellKnown'
    } |
    Sort-Object -Property InterfaceAlias |
    Select-Object -ExpandProperty IPAddress)

  if ($addresses.Count -gt 0) {
    return $addresses[0]
  }

  return '127.0.0.1'
}

function Ensure-PostgresContainer {
  try {
    docker info | Out-Null
  } catch {
    $dockerDesktop = 'C:\Program Files\Docker\Docker\Docker Desktop.exe'

    if (-not (Test-Path $dockerDesktop)) {
      Write-LaunchLog 'Docker Desktop was not found. Skipping PostgreSQL container startup.'
      return
    }

    Write-LaunchLog 'Starting Docker Desktop.'
    Start-Process -FilePath $dockerDesktop -WindowStyle Hidden

    $deadline = (Get-Date).AddSeconds(90)
    while ((Get-Date) -lt $deadline) {
      try {
        docker info | Out-Null
        break
      } catch {
        Start-Sleep -Seconds 3
      }
    }
  }

  try {
    docker compose up -d postgres | Out-Null
    Write-LaunchLog 'PostgreSQL container is ready.'
  } catch {
    Write-LaunchLog ('PostgreSQL container was not started: ' + $_.Exception.Message)
  }
}

New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
Set-Content -Path $launcherLog -Value '' -Encoding UTF8
Set-Location $projectRoot

trap {
  Write-LaunchLog ('ERROR: ' + $_.Exception.Message)
  throw
}

$localIp = Get-LocalLanIp
$backendUrl = "http://127.0.0.1:$backendPort"
$frontendLocalUrl = "http://127.0.0.1:$frontendPort"
$frontendLanUrl = "http://$localIp`:$frontendPort"
$backendLog = Join-Path $logsDir 'backend.log'
$frontendLog = Join-Path $logsDir 'frontend.log'

Write-LaunchLog 'Starting simple npm launcher.'
Write-LaunchLog 'This launcher starts PostgreSQL container when Docker Desktop is available.'
Write-LaunchLog "Detected LAN frontend URL: $frontendLanUrl"

Stop-OldEsoftProcesses
Write-LaunchLog 'Old Esoft node processes stopped.'
Ensure-PostgresContainer

Start-Process -FilePath 'cmd.exe' -WindowStyle Hidden -WorkingDirectory (Join-Path $projectRoot 'backend') -ArgumentList @(
  '/d',
  '/s',
  '/c',
  "set FRONTEND_URL=$frontendLocalUrl&& set BETTER_AUTH_URL=$backendUrl&& npm.cmd run start > `"$backendLog`" 2>&1"
)

if (-not (Wait-HttpReady -Url "$backendUrl/" -TimeoutSeconds 60)) {
  Write-LaunchLog 'Backend did not start.'
  throw "Backend did not start. Check $backendLog. PostgreSQL must be running and DATABASE_URL must be correct."
}

Write-LaunchLog 'Backend is ready.'

Start-Process -FilePath 'cmd.exe' -WindowStyle Hidden -WorkingDirectory (Join-Path $projectRoot 'frontend') -ArgumentList @(
  '/d',
  '/s',
  '/c',
  "npm.cmd run dev -- --host 0.0.0.0 > `"$frontendLog`" 2>&1"
)

if (-not (Wait-HttpReady -Url "$frontendLocalUrl/" -TimeoutSeconds 60)) {
  Write-LaunchLog 'Frontend did not start.'
  throw "Frontend did not start. Check $frontendLog."
}

Write-LaunchLog 'Frontend is ready. Opening browser.'
Write-LaunchLog "Open from this computer: $frontendLocalUrl/#/login"
Write-LaunchLog "Open from phone in the same Wi-Fi/LAN: $frontendLanUrl/#/login"
Start-Process "$frontendLocalUrl/#/login"
