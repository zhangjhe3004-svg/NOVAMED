# Stop MediCode backend and frontend processes before restarting.
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File stop_services.ps1
$ErrorActionPreference = "SilentlyContinue"

$killed = @()

# Backend: any python process running `uvicorn ... app.main`
Get-CimInstance Win32_Process -Filter "Name='python.exe'" |
  Where-Object { $_.CommandLine -match 'uvicorn' -and $_.CommandLine -match 'app\.main' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue; $script:killed += "backend($($_.ProcessId))" }

# Backend worker subprocesses spawned via multiprocessing (uvicorn --reload / app workers)
Get-CimInstance Win32_Process -Filter "Name='python.exe'" |
  Where-Object { $_.CommandLine -match 'multiprocessing' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue; $script:killed += "mp($($_.ProcessId))" }

# Frontend: any node process running vite under the MediCode project path
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -match 'vite' -and $_.CommandLine -match 'MediCode' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue; $script:killed += "frontend($($_.ProcessId))" }

# npm wrappers (npm run dev / dev:patient)
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -match 'npm-cli\.js' -and $_.CommandLine -match 'run dev' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue; $script:killed += "npm($($_.ProcessId))" }

# Fallback: kill anything still listening on known MediCode ports
$ports = 18001, 18002, 3051, 3052, 3005, 3006
foreach ($p in $ports) {
    Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue |
      ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue; $script:killed += "port$p($($_.OwningProcess))" }
}

if ($script:killed.Count -gt 0) {
    Write-Host "Stopped old services: $($script:killed -join ', ')" -ForegroundColor Green
} else {
    Write-Host "No old services found."
}
