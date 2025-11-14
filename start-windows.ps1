Param(
    [switch]$Rebuild
)

$platform = "Windows"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir
$projectName = "xxsy"
$env:COMPOSE_PROJECT_NAME = $projectName

function Test-DockerEngine {
    try {
        docker info *> $null
        return $true
    } catch {
        return $false
    }
}

function Get-ComposeCommand {
    $dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
    if ($dockerCmd) {
        docker compose version *> $null
        if ($LASTEXITCODE -eq 0) {
            return @{ Executable = "docker"; Prefix = @("compose") ; Display = "docker compose" }
        }
    }

    $dockerComposeCmd = Get-Command docker-compose -ErrorAction SilentlyContinue
    if ($dockerComposeCmd) {
        return @{ Executable = "docker-compose"; Prefix = @(); Display = "docker-compose" }
    }

    throw "[$platform] 未检测到 Docker Compose，请先安装 Docker Desktop 或 docker-compose。"
}

try {
    $compose = Get-ComposeCommand
} catch {
    Write-Error $_.Exception.Message
    exit 1
}

if (Get-Command docker -ErrorAction SilentlyContinue) {
    if (-not (Test-DockerEngine)) {
        Write-Error "[$platform] 检测到 Docker 未启动，请先启动 Docker Desktop。"
        exit 1
    }
}

function Invoke-ComposeCommand {
    param(
        [string[]]$Args
    )

    $fullArgs = @()
    $fullArgs += $compose.Prefix
    $fullArgs += $Args

    & $compose.Executable @fullArgs
    return $LASTEXITCODE
}

$composeArgs = @("up", "-d")
if ($Rebuild.IsPresent) {
    $composeArgs += "--build"
}

Write-Host "[$platform] 使用 Docker Compose 启动教育实践平台..." -ForegroundColor Cyan
$startExit = Invoke-ComposeCommand $composeArgs
if ($startExit -ne 0) {
    Write-Error "[$platform] 启动失败，请检查上面的错误信息。"
    exit $startExit
}

function Ensure-BackendReady {
    param(
        [int]$MaxRetries = 5,
        [int]$DelaySeconds = 5
    )

    for ($attempt = 1; $attempt -le $MaxRetries; $attempt++) {
        Write-Host "[$platform] 确保 backend 容器就绪（尝试 $attempt/$MaxRetries）..." -ForegroundColor Cyan

        if ((Invoke-ComposeCommand @("up", "-d", "backend")) -eq 0) {
            Write-Host "[$platform] backend 已成功启动。" -ForegroundColor Green
            return $true
        }

        if ($attempt -eq $MaxRetries) {
            Write-Error "[$platform] backend 连续 $MaxRetries 次启动失败，请检查数据库或后端日志。"
            return $false
        }

        Write-Host "[$platform] backend 启动失败，$DelaySeconds 秒后重试..." -ForegroundColor Yellow
        Start-Sleep -Seconds $DelaySeconds
    }
}

if (-not (Ensure-BackendReady)) {
    exit 1
}

Write-Host ""
Write-Host "服务已启动：" -ForegroundColor Green
Write-Host "- MySQL:      3306 (容器内部访问)" -ForegroundColor Gray
Write-Host "- 后端 API:   http://localhost:28964" -ForegroundColor Gray
Write-Host "- 管理端：    http://localhost:18964" -ForegroundColor Gray
Write-Host "- 用户端：    http://localhost:8964" -ForegroundColor Gray
Write-Host ""
Write-Host "查看日志： $($compose.Display) logs -f backend" -ForegroundColor Yellow
Write-Host "停止服务： $($compose.Display) down" -ForegroundColor Yellow
