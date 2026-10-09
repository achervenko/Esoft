[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$ProjectRoot,
    [Parameter(Mandatory = $true)][string]$NodePath,
    [string]$BackendService = 'EsoftBackend',
    [switch]$LeaveStopped
)

$ErrorActionPreference = 'Stop'
$exitCode = 1
$wasRunning = $false
try {
    $root = (Resolve-Path -LiteralPath $ProjectRoot).Path
    $node = (Resolve-Path -LiteralPath $NodePath).Path
    $backupScript = Join-Path $root 'scripts\prod\backup-prod.mjs'
    if (!(Test-Path -LiteralPath $backupScript -PathType Leaf)) {
        throw 'Backup entrypoint is missing.'
    }
    $service = Get-Service -Name $BackendService
    if ($service.Status -notin @('Running', 'Stopped')) {
        throw 'Backend service is in a transitional state.'
    }
    $wasRunning = $service.Status -eq 'Running'
    if ($wasRunning) {
        Stop-Service -Name $BackendService
        (Get-Service -Name $BackendService).WaitForStatus('Stopped', [TimeSpan]::FromSeconds(90))
    }
    Push-Location -LiteralPath $root
    try {
        & $node $backupScript
        if ($LASTEXITCODE -ne 0) { throw "Backup failed with exit code $LASTEXITCODE." }
        $exitCode = 0
        Write-Host 'Backup completed successfully.'
    } finally {
        Pop-Location
    }
} catch {
    Write-Error -Message $_ -ErrorAction Continue
} finally {
    if ($wasRunning -and !$LeaveStopped) {
        try {
            Start-Service -Name $BackendService
            (Get-Service -Name $BackendService).WaitForStatus('Running', [TimeSpan]::FromSeconds(90))
        } catch {
            if ($exitCode -eq 0) {
                Write-Error -Message 'Backup succeeded, but backend service failed to restart.' -ErrorAction Continue
            } else {
                Write-Error -Message 'Backup failed, and backend service also failed to restart.' -ErrorAction Continue
            }
            Write-Error -Message $_ -ErrorAction Continue
            $exitCode = 1
        }
    }
}
exit $exitCode
