$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $projectRoot 'tools\Set-Utf8Console.ps1')
$configPath = Join-Path $projectRoot 'esoft.config.json'

if (-not (Test-Path $configPath)) {
  throw "Config file was not found: $configPath"
}

$config = Get-Content -Raw -Path $configPath -Encoding UTF8 | ConvertFrom-Json

$backendPort = if ($config.network.backendPort) { [int]$config.network.backendPort } else { 3000 }
$frontendPort = if ($config.network.frontendPort) { [int]$config.network.frontendPort } else { 5173 }
$logsDirectory = if ($config.logs.directory) { [string]$config.logs.directory } else { 'logs' }
$logsDir = Join-Path $projectRoot $logsDirectory
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

function Get-ConfiguredHost {
  param([string] $HostValue)

  if (-not $HostValue -or $HostValue -eq 'auto') {
    return Get-LanIpAddress
  }

  return $HostValue
}

function Set-OrAddEnvValue {
  param(
    [string] $Path,
    [string] $Name,
    [string] $Value
  )

  $line = "$Name=$Value"

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

function Write-FirewallHint {
  $rules = Get-NetFirewallRule -DisplayName 'Esoft Local Network*' -ErrorAction SilentlyContinue |
    Where-Object { $_.Enabled -eq 'True' -and $_.Action -eq 'Allow' }

  if (-not $rules) {
    Write-LaunchLog 'Local network firewall rules were not found. If phones cannot open Esoft, run setup-network-access.ps1 as administrator once.'
  }
}

function Sync-EnvFiles {
  param(
    [string] $BackendUrl,
    [string] $FrontendUrl
  )

  $db = $config.database
  $databaseHost = if ($db.host) { [string]$db.host } else { 'localhost' }
  $databasePort = if ($db.port) { [int]$db.port } else { 5433 }
  $databaseName = if ($db.name) { [string]$db.name } else { 'esoft' }
  $databaseUser = if ($db.user) { [string]$db.user } else { 'esoft' }
  $databasePassword = if ($db.password) { [string]$db.password } else { 'esoft_password' }
  $databaseSchema = if ($db.schema) { [string]$db.schema } else { 'public' }
  $databaseUrl = "postgresql://$databaseUser`:$databasePassword@$databaseHost`:$databasePort/$databaseName`?schema=$databaseSchema"
  $authSecret = if ($config.auth.secret) { [string]$config.auth.secret } else { 'replace-with-generated-secret' }

  Set-OrAddEnvValue -Path (Join-Path $projectRoot 'backend\.env') -Name 'DATABASE_URL' -Value $databaseUrl
  Set-OrAddEnvValue -Path (Join-Path $projectRoot 'backend\.env') -Name 'PORT' -Value ([string]$backendPort)
  Set-OrAddEnvValue -Path (Join-Path $projectRoot 'backend\.env') -Name 'BETTER_AUTH_SECRET' -Value $authSecret
  Set-OrAddEnvValue -Path (Join-Path $projectRoot 'backend\.env') -Name 'BETTER_AUTH_URL' -Value $BackendUrl
  Set-OrAddEnvValue -Path (Join-Path $projectRoot 'backend\.env') -Name 'FRONTEND_URL' -Value $FrontendUrl

  Set-OrAddEnvValue -Path (Join-Path $projectRoot 'frontend\.env') -Name 'VITE_API_URL' -Value ''
}

New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
Set-Content -Path $launcherLog -Value '' -Encoding UTF8
Set-Location $projectRoot

trap {
  Write-LaunchLog ('ERROR: ' + $_.Exception.Message)
  break
}

Write-LaunchLog 'Starting Esoft launcher.'

$hostAddress = Get-ConfiguredHost -HostValue ([string]$config.network.host)
$localBackendUrl = "http://127.0.0.1:$backendPort"
$localFrontendUrl = "http://127.0.0.1:$frontendPort"
$lanBackendUrl = "http://$hostAddress`:$backendPort"
$lanFrontendUrl = "http://$hostAddress`:$frontendPort"
$openAddress = if ($config.app.openAddress) { [string]$config.app.openAddress } else { 'local' }
$browserUrl = if ($openAddress -eq 'lan') { $lanFrontendUrl } else { $localFrontendUrl }

Sync-EnvFiles -BackendUrl $lanBackendUrl -FrontendUrl $lanFrontendUrl
Write-LaunchLog "Using frontend URL $lanFrontendUrl and backend URL $lanBackendUrl."
Write-LaunchLog "Browser URL is $browserUrl/#/login."
Write-FirewallHint

Stop-OldEsoftProcesses
Write-LaunchLog 'Old Esoft processes stopped.'
Write-LaunchLog 'PostgreSQL must be running as a local service or an external database.'

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

$backendReady = Wait-HttpReady -Url "$localBackendUrl/" -TimeoutSeconds 90

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

$frontendReady = Wait-HttpReady -Url "$localFrontendUrl/" -TimeoutSeconds 90

if (-not $frontendReady) {
  Write-LaunchLog "Readiness failed. backendReady=$backendReady frontendReady=$frontendReady"
  throw 'Esoft did not start. Check logs in the logs folder.'
}

Write-LaunchLog 'Esoft is ready.'

if ($config.app.openBrowser -ne $false) {
  Write-LaunchLog 'Opening browser.'
  Start-Process "$browserUrl/#/login"
}
