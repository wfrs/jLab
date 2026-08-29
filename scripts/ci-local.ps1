Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Run-Step {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][scriptblock]$Action
    )
    Write-Host ""
    Write-Host "==> $Name" -ForegroundColor Cyan
    & $Action
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir

Set-Location $repoRoot

Write-Host "Running local CI in: $repoRoot" -ForegroundColor Green

Run-Step -Name "Validating required project policy file" -Action {
    if (-not (Test-Path (Join-Path $repoRoot "AGENTS.md"))) {
        throw "AGENTS.md not found at repository root."
    }
}

Run-Step -Name "Validating legacy reference folder is present" -Action {
    if (-not (Test-Path (Join-Path $repoRoot "gmocu"))) {
        throw "Legacy reference folder 'gmocu' not found."
    }
}

if (Test-Path (Join-Path $repoRoot "pyproject.toml")) {
    Run-Step -Name "Python: running pytest" -Action {
        python -m pytest
    }
} else {
    Write-Host "Skipping Python tests (pyproject.toml not found)." -ForegroundColor Yellow
}

if (Test-Path (Join-Path $repoRoot "package.json")) {
    Run-Step -Name "Node: running npm test" -Action {
        npm test
    }
} else {
    Write-Host "Skipping Node tests (package.json not found)." -ForegroundColor Yellow
}

if (Test-Path (Join-Path $repoRoot "tests")) {
    Run-Step -Name "Reporting test folders" -Action {
        Get-ChildItem (Join-Path $repoRoot "tests") -Directory | Select-Object -ExpandProperty Name
    }
}

Write-Host ""
Write-Host "Local CI completed successfully." -ForegroundColor Green

