$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$configPath = Join-Path $projectRoot 'esoft.config.json'

if (-not (Test-Path $configPath)) {
  throw "Config file was not found: $configPath"
}

$config = Get-Content -Raw -Path $configPath -Encoding UTF8 | ConvertFrom-Json
$backendPort = if ($config.network.backendPort) { [int]$config.network.backendPort } else { 3000 }
$frontendPort = if ($config.network.frontendPort) { [int]$config.network.frontendPort } else { 5173 }
$logsDirectory = if ($config.logs.directory) { [string]$config.logs.directory } else { 'logs' }
$logsDir = Join-Path $projectRoot $logsDirectory
$launcherLog = Join-Path $logsDir 'server-window.log'

function Write-Status {
  param([string] $Message)

  $timestamp = Get-Date -Format 'HH:mm:ss'
  Write-Host "[$timestamp] $Message"
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

function Sync-EnvFiles {
  param(
    [string] $BackendUrl,
    [string] $FrontendUrl
  )

  $db = $config.database
  $databaseHost = if ($db.host) { [string]$db.host } else { 'localhost' }
  $databasePort = if ($db.port) { [int]$db.port } else { 5432 }
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

function Test-PostgresReady {
  $db = $config.database
  $databaseHost = if ($db.host) { [string]$db.host } else { 'localhost' }
  $databasePort = if ($db.port) { [int]$db.port } else { 5432 }

  $connection = Get-NetTCPConnection -RemoteAddress $databaseHost -RemotePort $databasePort -ErrorAction SilentlyContinue
  if ($connection) {
    return $true
  }

  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $async = $client.BeginConnect($databaseHost, $databasePort, $null, $null)
    $ready = $async.AsyncWaitHandle.WaitOne(3000)
    if ($ready) {
      $client.EndConnect($async)
      $client.Close()
      return $true
    }
  } catch {
    return $false
  }

  return $false
}

New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
Set-Content -Path $launcherLog -Value '' -Encoding UTF8
Set-Location $projectRoot

$hostAddress = Get-ConfiguredHost -HostValue ([string]$config.network.host)
$localBackendUrl = "http://127.0.0.1:$backendPort"
$localFrontendUrl = "http://127.0.0.1:$frontendPort"
$lanBackendUrl = "http://$hostAddress`:$backendPort"
$lanFrontendUrl = "http://$hostAddress`:$frontendPort"
$openAddress = if ($config.app.openAddress) { [string]$config.app.openAddress } else { 'local' }
$browserUrl = if ($openAddress -eq 'lan') { $lanFrontendUrl } else { $localFrontendUrl }
$backendLog = Join-Path $logsDir 'backend.log'
$frontendLog = Join-Path $logsDir 'frontend.log'
$backendProcess = $null
$frontendProcess = $null

try {
  Clear-Host
  Write-Host 'Esoft server window' -ForegroundColor Cyan
  Write-Host 'Close this window or press Ctrl+C to stop backend and frontend.'
  Write-Host ''

  Write-Status 'Syncing config and env files.'
  Sync-EnvFiles -BackendUrl $lanBackendUrl -FrontendUrl $lanFrontendUrl

  if (-not (Test-PostgresReady)) {
    throw 'PostgreSQL is not available. Start PostgreSQL service and try again.'
  }

  Write-Status 'Stopping old Esoft processes.'
  Stop-OldEsoftProcesses

  Write-Status 'Starting backend.'
  $backendProcess = Start-Process -FilePath 'cmd.exe' -WindowStyle Hidden -PassThru -WorkingDirectory (Join-Path $projectRoot 'backend') -ArgumentList @(
    '/d',
    '/s',
    '/c',
    "npm.cmd run start > `"$backendLog`" 2>&1"
  )

  if (-not (Wait-HttpReady -Url "$localBackendUrl/" -TimeoutSeconds 90)) {
    throw "Backend did not start. Check $backendLog"
  }

  Write-Status 'Starting frontend.'
  $frontendProcess = Start-Process -FilePath 'cmd.exe' -WindowStyle Hidden -PassThru -WorkingDirectory (Join-Path $projectRoot 'frontend') -ArgumentList @(
    '/d',
    '/s',
    '/c',
    "npm.cmd run dev -- --host 0.0.0.0 > `"$frontendLog`" 2>&1"
  )

  if (-not (Wait-HttpReady -Url "$localFrontendUrl/" -TimeoutSeconds 90)) {
    throw "Frontend did not start. Check $frontendLog"
  }

  Write-Status 'Esoft is ready.'
  Write-Host ''
  Write-Host "Open on this computer: $localFrontendUrl/#/login" -ForegroundColor Green
  Write-Host "Open in local network: $lanFrontendUrl/#/login" -ForegroundColor Green
  Write-Host ''

  if ($config.app.openBrowser -ne $false) {
    Start-Process "$browserUrl/#/login"
  }

  Write-Host 'Live server window is active. Press Ctrl+C to stop.' -ForegroundColor Yellow
  while ($true) {
    Start-Sleep -Seconds 5

    if ($backendProcess.HasExited) {
      throw "Backend process stopped. Check $backendLog"
    }

    if ($frontendProcess.HasExited) {
      throw "Frontend process stopped. Check $frontendLog"
    }
  }
} catch {
  Write-Host ''
  Write-Host $_.Exception.Message -ForegroundColor Red
  Write-Host ''
  Write-Host "Backend log: $backendLog"
  Write-Host "Frontend log: $frontendLog"
  Write-Host ''
  Read-Host 'Press Enter to close'
} finally {
  if ($backendProcess -and -not $backendProcess.HasExited) {
    Stop-Process -Id $backendProcess.Id -Force -ErrorAction SilentlyContinue
  }

  if ($frontendProcess -and -not $frontendProcess.HasExited) {
    Stop-Process -Id $frontendProcess.Id -Force -ErrorAction SilentlyContinue
  }
}
