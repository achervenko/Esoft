$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $projectRoot 'tools\Set-Utf8Console.ps1')
$launcher = Join-Path $projectRoot 'start-esoft.ps1'

& $launcher
