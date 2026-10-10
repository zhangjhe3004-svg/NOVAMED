# 自动检测空闲端口并分配
# 用法：powershell -ExecutionPolicy Bypass -File select_free_port.ps1

function Test-Port {
    param($Port, $Host = "127.0.0.1")
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $tcp.Connect($Host, $Port)
        $tcp.Close()
        return $true  # 端口被占用
    } catch {
        return $false # 端口空闲
    }
}

function Find-FreePort {
    param($StartPort, $EndPort = 65535, $Host = "127.0.0.1")
    for ($port = $StartPort; $port -le $EndPort; $port++) {
        if (-not (Test-Port $Port $Host)) {
            return $port
        }
    }
    return -1
}

# 默认端口配置
$backend_default = 18001
$staff_default = 3051
$patient_default = 3005

# 检查并分配端口
$backend_port = if (Test-Port $backend_default) { Find-FreePort $backend_default } else { $backend_default }
$staff_port = if (Test-Port $staff_default) { Find-FreePort $staff_default } else { $staff_default }
$patient_port = if (Test-Port $patient_default) { Find-FreePort $patient_default } else { $patient_default }

# 输出端口配置
Write-Output "BACKEND_PORT=$backend_port"
Write-Output "STAFF_PORT=$staff_port"
Write-Output "PATIENT_PORT=$patient_port"

# 显示分配结果
Write-Host "端口分配结果:" -ForegroundColor Green
Write-Host "后端端口: $backend_port" -ForegroundColor Cyan
Write-Host "员工前端: $staff_port" -ForegroundColor Cyan
Write-Host "患者前端: $patient_port" -ForegroundColor Cyan
