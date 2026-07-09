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

New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
Set-Content -Path $launcherLog -Value '' -Encoding UTF8
Set-Location $projectRoot

trap {
  Write-LaunchLog ('ERROR: ' + $_.Exception.Message)
  throw
}

$backendUrl = "http://127.0.0.1:$backendPort"
$frontendUrl = "http://127.0.0.1:$frontendPort"
$backendLog = Join-Path $logsDir 'backend.log'
$frontendLog = Join-Path $logsDir 'frontend.log'

Write-LaunchLog 'Starting simple npm launcher.'
Write-LaunchLog 'This launcher does not start Docker or PostgreSQL. DATABASE_URL must already be available.'

Stop-OldEsoftProcesses
Write-LaunchLog 'Old Esoft node processes stopped.'

Start-Process -FilePath 'cmd.exe' -WindowStyle Hidden -WorkingDirectory (Join-Path $projectRoot 'backend') -ArgumentList @(
  '/d',
  '/s',
  '/c',
  "npm.cmd run start > `"$backendLog`" 2>&1"
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
  "npm.cmd run dev -- --host 127.0.0.1 > `"$frontendLog`" 2>&1"
)

if (-not (Wait-HttpReady -Url "$frontendUrl/" -TimeoutSeconds 60)) {
  Write-LaunchLog 'Frontend did not start.'
  throw "Frontend did not start. Check $frontendLog."
}

Write-LaunchLog 'Frontend is ready. Opening browser.'
Start-Process "$frontendUrl/#/login"
