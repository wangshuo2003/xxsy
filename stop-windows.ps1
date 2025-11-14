Param(
    [switch]$RemoveVolumes
)

$platform = "Windows"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

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
            return @{ Executable = "docker"; Prefix = @("compose"); Display = "docker compose" }
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

$composeArgs = @("down")
if ($RemoveVolumes.IsPresent) {
    $composeArgs += "-v"
}
$fullArgs = @()
$fullArgs += $compose.Prefix
$fullArgs += $composeArgs

Write-Host "[$platform] 正在停止教育实践平台..." -ForegroundColor Cyan
& $compose.Executable @fullArgs

if ($LASTEXITCODE -ne 0) {
    Write-Error "[$platform] 停止失败，请检查上面的错误信息。"
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "所有容器和网络已停止。" -ForegroundColor Green
if ($RemoveVolumes.IsPresent) {
    Write-Host "提示：已同时移除持久化卷。" -ForegroundColor Yellow
}
Write-Host "如需重新启动，请运行 $($compose.Display) up -d 或使用对应的 start 脚本。" -ForegroundColor Gray
