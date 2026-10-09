[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
try {
    $settings = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'renewal-settings.json') -Raw | ConvertFrom-Json
    $caddy = (Resolve-Path -LiteralPath $settings.CaddyPath).Path
    $config = (Resolve-Path -LiteralPath $settings.CaddyfilePath).Path
    & $caddy validate --config $config --adapter caddyfile
    if ($LASTEXITCODE -ne 0) { throw 'Caddy validation failed; running proxy has not been reloaded.' }
    # Force is required: PEM contents changed while the Caddyfile stayed identical.
    & $caddy reload --config $config --adapter caddyfile --address 127.0.0.1:2019 --force
    if ($LASTEXITCODE -ne 0) { throw 'Caddy certificate reload failed.' }
    Write-Host 'HTTPS proxy certificate reloaded successfully.'
    exit 0
} catch {
    Write-Error -Message $_.Exception.Message -ErrorAction Continue
    exit 1
}
