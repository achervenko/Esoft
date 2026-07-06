$ErrorActionPreference = 'Stop'

$projectRoot = 'C:\Users\alex\Documents\New project\Esoft'
$backendPort = 3000
$frontendPort = 5173
$logsDir = Join-Path $projectRoot 'logs'
$launcherLog = Join-Path $logsDir 'launcher.log'

function Write-LaunchLog {
  param([string] $Message)

  $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
  Add-Content -Path $launcherLog -Value "[$timestamp] $Message" -Encoding UTF8
}

function Get-LanIpAddress {
  $preferred = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object {
      $_.IPAddress -notlike '127.*' -and
      $_.IPAddress -notlike '169.254.*' -and
      $_.InterfaceAlias -notlike 'vEthernet*' -and
      $_.InterfaceAlias -notlike '*WSL*' -and
      $_.InterfaceAlias -notlike '*Default Switch*' -and
      $_.InterfaceAlias -notlike '*Radmin*' -and
      $_.InterfaceAlias -notlike 'tun*'
    } |
    Sort-Object `
      @{ Expression = { if ($_.PrefixOrigin -eq 'Dhcp') { 0 } else { 1 } } }, `
      @{ Expression = { if ($_.IPAddress -like '192.168.*') { 0 } else { 1 } } }, `
      @{ Expression = 'InterfaceAlias' } |
    Select-Object -First 1

  if ($preferred) {
    return $preferred.IPAddress
  }

  return '127.0.0.1'
}

function Set-OrAddEnvValue {
  param(
    [string] $Path,
    [string] $Name,
    [string] $Value
  )

  $line = "$Name=`"$Value`""

  if (-not (Test-Path $Path)) {
    Set-Content -Path $Path -Value $line -Encoding UTF8
    return
  }

  $content = Get-Content -Path $Path
  $escapedName = [regex]::Escape($Name)
  $found = $false

  $updated = $content | ForEach-Object {
    if ($_ -match "^$escapedName=") {
      $found = $true
      $line
    } else {
      $_
    }
  }

  if (-not $found) {
    $updated += $line
  }

  Set-Content -Path $Path -Value $updated -Encoding UTF8
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
    [int] $TimeoutSeconds = 90
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

function Wait-DockerReady {
  param([int] $TimeoutSeconds = 120)

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

  while ((Get-Date) -lt $deadline) {
    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    docker info 1>$null 2>$null
    $dockerExitCode = $LASTEXITCODE
    $ErrorActionPreference = $previousErrorActionPreference

    if ($dockerExitCode -eq 0) {
      return $true
    }

    Start-Sleep -Seconds 3
  }

  return $false
}

function Write-FirewallHint {
  $rules = Get-NetFirewallRule -DisplayName 'Esoft Local Network*' -ErrorAction SilentlyContinue |
    Where-Object { $_.Enabled -eq 'True' -and $_.Action -eq 'Allow' }

  if (-not $rules) {
    Write-LaunchLog 'Local network firewall rules were not found. If phones cannot open Esoft, run setup-network-access.ps1 as administrator once.'
  }
}

New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
Set-Content -Path $launcherLog -Value '' -Encoding UTF8
Set-Location $projectRoot

trap {
  Write-LaunchLog ('ERROR: ' + $_.Exception.Message)
  break
}

Write-LaunchLog 'Starting Esoft launcher.'

$lanIp = Get-LanIpAddress
$backendUrl = "http://$lanIp`:$backendPort"
$frontendUrl = "http://$lanIp`:$frontendPort"

Set-OrAddEnvValue -Path (Join-Path $projectRoot 'frontend\.env') -Name 'VITE_API_URL' -Value ''
Set-OrAddEnvValue -Path (Join-Path $projectRoot 'backend\.env') -Name 'BETTER_AUTH_URL' -Value $backendUrl
Set-OrAddEnvValue -Path (Join-Path $projectRoot 'backend\.env') -Name 'FRONTEND_URL' -Value $frontendUrl
Write-LaunchLog "Using frontend URL $frontendUrl and backend URL $backendUrl."
Write-FirewallHint

Stop-OldEsoftProcesses
Write-LaunchLog 'Old Esoft processes stopped.'

if (-not (Wait-DockerReady -TimeoutSeconds 5)) {
  $dockerDesktop = 'C:\Program Files\Docker\Docker\Docker Desktop.exe'

  if (Test-Path $dockerDesktop) {
    Write-LaunchLog 'Starting Docker Desktop.'
    Start-Process -FilePath $dockerDesktop
  }
}

if (-not (Wait-DockerReady -TimeoutSeconds 240)) {
  Write-LaunchLog 'Docker Desktop is not ready.'
  throw 'Docker Desktop is not ready. Start Docker Desktop and run Esoft again.'
}

Write-LaunchLog 'Docker Desktop is ready.'
docker compose up -d postgres

if ($LASTEXITCODE -ne 0) {
  Write-LaunchLog 'PostgreSQL container did not start.'
  throw 'PostgreSQL container did not start. Check Docker Desktop.'
}

Write-LaunchLog 'PostgreSQL container is running.'

$backendLog = Join-Path $logsDir 'backend.log'
$frontendLog = Join-Path $logsDir 'frontend.log'
$backendCommand = "npm.cmd run start > `"$backendLog`" 2>&1"
$frontendCommand = "npm.cmd run dev -- --host 0.0.0.0 > `"$frontendLog`" 2>&1"

Write-LaunchLog 'Starting backend.'
Start-Process -FilePath 'cmd.exe' -WindowStyle Hidden -WorkingDirectory (Join-Path $projectRoot 'backend') -ArgumentList @(
  '/d',
  '/s',
  '/c',
  $backendCommand
)

$backendReady = Wait-HttpReady -Url "$backendUrl/" -TimeoutSeconds 90

if (-not $backendReady) {
  Write-LaunchLog 'Readiness failed. backendReady=False frontendReady=NotStarted'
  throw 'Esoft backend did not start. Check logs in the logs folder.'
}

Write-LaunchLog 'Starting frontend.'
Start-Process -FilePath 'cmd.exe' -WindowStyle Hidden -WorkingDirectory (Join-Path $projectRoot 'frontend') -ArgumentList @(
  '/d',
  '/s',
  '/c',
  $frontendCommand
)

$frontendReady = Wait-HttpReady -Url "$frontendUrl/" -TimeoutSeconds 90

if (-not $frontendReady) {
  Write-LaunchLog "Readiness failed. backendReady=$backendReady frontendReady=$frontendReady"
  throw 'Esoft did not start. Check logs in the logs folder.'
}

Write-LaunchLog 'Esoft is ready. Opening browser.'
Start-Process "$frontendUrl/#/login"
