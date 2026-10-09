[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)][ValidateSet('create', 'delete')][string]$Action,
    [Parameter(Mandatory = $true, Position = 1)][string]$Identifier,
    [Parameter(Mandatory = $true, Position = 2)][string]$RecordName,
    [Parameter(Mandatory = $true, Position = 3)][string]$Token
)

$ErrorActionPreference = 'Stop'
try {
    $settings = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'renewal-settings.json') -Raw | ConvertFrom-Json
    if ($Identifier -cne $settings.AllowedZone -or $RecordName -cne "_acme-challenge.$($settings.AllowedZone)") {
        throw 'Only the configured zone and its _acme-challenge TXT record are permitted.'
    }
    $Zone = $settings.AllowedZone
    $NodeName = '_acme-challenge'
    if ($Token -notmatch '^[A-Za-z0-9_-]{43}$') { throw 'Invalid DNS challenge token.' }
    $credential = Import-Clixml -LiteralPath (Join-Path $PSScriptRoot 'RegRu.credential.xml')
    if ($credential -isnot [pscredential]) { throw 'Invalid REG.RU credential file.' }

    function Invoke-RegRuZone {
        param([string]$Operation)
        $payload = @{
            username = $credential.UserName
            password = $credential.GetNetworkCredential().Password
            domains = @(@{ dname = $Zone })
            output_content_type = 'plain'
        }
        if ($Operation -eq 'add_txt') {
            $payload.subdomain = $NodeName
            $payload.text = $Token
        }
        if ($Operation -eq 'remove_record') {
            $payload.subdomain = $NodeName
            $payload.record_type = 'TXT'
            $payload.content = $Token
        }
        try {
            $response = Invoke-RestMethod -Uri "https://api.reg.ru/api/regru2/zone/$Operation" -Method Post -ContentType 'application/x-www-form-urlencoded' -Body @{
                input_format = 'json'
                input_data = ($payload | ConvertTo-Json -Compress -Depth 5)
            } -TimeoutSec 60 -Verbose:$false -Debug:$false
        } catch {
            # API errors may contain request credentials; never print raw errors.
            throw "REG.RU request failed: $Operation. Check connectivity and API access."
        }
        if ($response.result -ne 'success') { throw "REG.RU rejected $Operation. Check API credentials and allowed IPs." }
        $domain = @($response.answer.domains | Where-Object { $_.dname -eq $Zone })
        if ($domain.Count -ne 1 -or $domain[0].result -ne 'success') {
            throw "REG.RU zone operation failed: $Operation."
        }
        return $domain[0]
    }

    $zoneRecords = Invoke-RegRuZone 'get_resource_records'
    $exists = @($zoneRecords.rrs | Where-Object {
        $_.rectype -eq 'TXT' -and $_.subname -eq $NodeName -and $_.content -ceq $Token
    }).Count -gt 0
    if ($Action -eq 'create' -and !$exists) { $null = Invoke-RegRuZone 'add_txt' }
    if ($Action -eq 'delete' -and $exists) { $null = Invoke-RegRuZone 'remove_record' }
    Write-Host "DNS hook completed: $Action."
    exit 0
} catch {
    Write-Error -Message $_.Exception.Message -ErrorAction Continue
    exit 1
}
