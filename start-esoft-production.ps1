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
$launcherLog = Join-Path $logsDir 'production-launcher.log'

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

function Wait-TcpReady {
  param(
    [string] $HostName,
    [int] $Port,
    [int] $TimeoutSeconds = 60
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

  while ((Get-Date) -lt $deadline) {
    try {
      $client = New-Object System.Net.Sockets.TcpClient
      $async = $client.BeginConnect($HostName, $Port, $null, $null)
      $ready = $async.AsyncWaitHandle.WaitOne(2000)
      if ($ready) {
        $client.EndConnect($async)
        $client.Close()
        return $true
      }
      $client.Close()
    } catch {
      Start-Sleep -Seconds 2
    }

    Start-Sleep -Seconds 2
  }

  return $false
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

function Invoke-Npm {
  param(
    [string] $WorkingDirectory,
    [string[]] $Arguments
  )

  Push-Location $WorkingDirectory
  try {
    & npm.cmd @Arguments
  } finally {
    Pop-Location
  }
}

function Ensure-NodeModules {
  param([string] $WorkingDirectory)

  if (-not (Test-Path (Join-Path $WorkingDirectory 'node_modules'))) {
    Invoke-Npm -WorkingDirectory $WorkingDirectory -Arguments @('ci')
  }
}

function Start-MinioIfConfigured {
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

  if (Wait-TcpReady -HostName '127.0.0.1' -Port 9000 -TimeoutSeconds 2) {
    Write-Status 'MinIO is already running.'
    return $null
  }

  Write-Status 'Starting MinIO.'
  return Start-Process -FilePath $minioExe -WindowStyle Hidden -PassThru -ArgumentList @(
    'server',
    $dataPath,
    '--console-address',
    ':9001'
  )
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
$backendLog = Join-Path $logsDir 'backend-production.log'
$frontendLog = Join-Path $logsDir 'frontend-production.log'
$backendProcess = $null
$frontendProcess = $null
$minioProcess = $null

try {
  Clear-Host
  Write-Host 'Esoft production launcher' -ForegroundColor Cyan
  Write-Host 'Close this window or press Ctrl+C to stop Esoft.'
  Write-Host ''

  Write-Status 'Syncing config and env files.'
  Sync-EnvFiles -BackendUrl $lanBackendUrl -FrontendUrl $lanFrontendUrl

  $db = $config.database
  $databaseHost = if ($db.host) { [string]$db.host } else { 'localhost' }
  $databasePort = if ($db.port) { [int]$db.port } else { 5432 }
  if (-not (Wait-TcpReady -HostName $databaseHost -Port $databasePort -TimeoutSeconds 10)) {
    throw 'PostgreSQL is not available. Start PostgreSQL service and try again.'
  }

  Stop-ProcessOnPort -Port $backendPort
  Stop-ProcessOnPort -Port $frontendPort

  $minioProcess = Start-MinioIfConfigured
  if (-not (Wait-TcpReady -HostName '127.0.0.1' -Port 9000 -TimeoutSeconds 30)) {
    throw 'MinIO did not start.'
  }

  Write-Status 'Installing dependencies if needed.'
  Ensure-NodeModules -WorkingDirectory (Join-Path $projectRoot 'backend')
  Ensure-NodeModules -WorkingDirectory (Join-Path $projectRoot 'frontend')

  Write-Status 'Generating Prisma client.'
  Invoke-Npm -WorkingDirectory (Join-Path $projectRoot 'backend') -Arguments @('run', 'prisma:generate')

  Write-Status 'Applying database migrations.'
  Push-Location (Join-Path $projectRoot 'backend')
  try {
    & npx.cmd prisma migrate deploy
  } finally {
    Pop-Location
  }

  Write-Status 'Building backend.'
  Invoke-Npm -WorkingDirectory (Join-Path $projectRoot 'backend') -Arguments @('run', 'build')

  Write-Status 'Building frontend.'
  Invoke-Npm -WorkingDirectory (Join-Path $projectRoot 'frontend') -Arguments @('run', 'build')

  Write-Status 'Starting backend.'
  $backendProcess = Start-Process -FilePath 'cmd.exe' -WindowStyle Hidden -PassThru -WorkingDirectory (Join-Path $projectRoot 'backend') -ArgumentList @(
    '/d',
    '/s',
    '/c',
    "npm.cmd run start:prod > `"$backendLog`" 2>&1"
  )

  if (-not (Wait-HttpReady -Url "$localBackendUrl/" -TimeoutSeconds 90)) {
    throw "Backend did not start. Check $backendLog"
  }

  Write-Status 'Starting frontend preview server.'
  $frontendProcess = Start-Process -FilePath 'cmd.exe' -WindowStyle Hidden -PassThru -WorkingDirectory (Join-Path $projectRoot 'frontend') -ArgumentList @(
    '/d',
    '/s',
    '/c',
    "npm.cmd run preview -- --host 0.0.0.0 --port $frontendPort > `"$frontendLog`" 2>&1"
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

  Write-Host 'Production launcher is active. Press Ctrl+C to stop.' -ForegroundColor Yellow
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

  if ($minioProcess -and -not $minioProcess.HasExited) {
    Stop-Process -Id $minioProcess.Id -Force -ErrorAction SilentlyContinue
  }
}

