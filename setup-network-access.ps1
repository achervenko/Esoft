$ErrorActionPreference = 'Stop'

$frontendPort = 5173
$backendPort = 3000
$rulePrefix = 'Esoft Local Network'

function Assert-Admin {
  $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = [Security.Principal.WindowsPrincipal]::new($currentUser)

  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Run this script as administrator.'
  }
}

function Set-FirewallRule {
  param(
    [string] $DisplayName,
    [int] $Port
  )

  Get-NetFirewallRule -DisplayName $DisplayName -ErrorAction SilentlyContinue |
    Remove-NetFirewallRule

  New-NetFirewallRule `
    -DisplayName $DisplayName `
    -Direction Inbound `
    -Action Allow `
    -Protocol TCP `
    -LocalPort $Port `
    -Profile Any | Out-Null
}

Assert-Admin

Set-FirewallRule -DisplayName "$rulePrefix Frontend $frontendPort" -Port $frontendPort
Set-FirewallRule -DisplayName "$rulePrefix Backend $backendPort" -Port $backendPort

Get-NetConnectionProfile |
  Where-Object {
    $_.IPv4Connectivity -ne 'NoTraffic' -and
    $_.InterfaceAlias -notlike '*Radmin*' -and
    $_.InterfaceAlias -notlike 'tun*' -and
    $_.InterfaceAlias -notlike 'vEthernet*'
  } |
  ForEach-Object {
    Set-NetConnectionProfile -InterfaceIndex $_.InterfaceIndex -NetworkCategory Private
  }

Write-Host 'Esoft local network access is configured.'
Write-Host "Frontend: http://<your-computer-ip>:$frontendPort"
Write-Host "Backend:  http://<your-computer-ip>:$backendPort"
