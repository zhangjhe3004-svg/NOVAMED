# Auto-detect free ports and update frontend/backend configs.
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File select_free_port.ps1
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

function Test-Port {
    param($Port, $HostName = "127.0.0.1")
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $tcp.Connect($HostName, $Port)
        $tcp.Close()
        return $true
    } catch {
        return $false
    }
}

function Find-FreePort {
    param($StartPort, $HostName = "127.0.0.1")
    for ($p = $StartPort; $p -le ($StartPort + 2000); $p++) {
        if (-not (Test-Port $p $HostName)) { return $p }
    }
    throw "No free port found (start: $StartPort)"
}

function Write-Utf8NoBom {
    param([string]$Path, [string]$Content)
    $enc = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Content, $enc)
}

$backend = Find-FreePort 18001
$staff = Find-FreePort 3051
$patient = Find-FreePort 3005

# Backend: update CORS origins. The PORT field is env-driven via BACKEND_PORT.
$config = Join-Path $root "backend\app\core\config.py"
$c = [System.IO.File]::ReadAllText($config)
$c = $c -replace 'CORS_ORIGINS: list\[str\] = .*', ('CORS_ORIGINS: list[str] = ["http://localhost:' + $staff + '", "http://localhost:' + $patient + '"]')
Write-Utf8NoBom $config $c

# Staff frontend.
$vc = Join-Path $root "frontend\vite.config.ts"
$c = [System.IO.File]::ReadAllText($vc)
$c = $c -replace 'port: \d+', "port: $staff"
$c = $c -replace 'target: "[^"]*"', ('target: "http://localhost:' + $backend + '"')
Write-Utf8NoBom $vc $c

# Patient frontend.
$vp = Join-Path $root "frontend\vite.patient.config.ts"
$c = [System.IO.File]::ReadAllText($vp)
$c = $c -replace 'port: \d+', "port: $patient"
$c = $c -replace 'target: "[^"]*"', ('target: "http://localhost:' + $backend + '"')
Write-Utf8NoBom $vp $c

# Persist allocated ports.
$ports = "BACKEND_PORT=$backend`r`nSTAFF_PORT=$staff`r`nPATIENT_PORT=$patient"
Write-Utf8NoBom (Join-Path $root "backend\.ports") $ports

Write-Output "BACKEND_PORT=$backend"
Write-Output "STAFF_PORT=$staff"
Write-Output "PATIENT_PORT=$patient"
Write-Host "Ports: backend $backend, staff $staff, patient $patient" -ForegroundColor Green