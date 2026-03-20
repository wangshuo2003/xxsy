Param(
    [switch]$Rebuild
)

# Ensure UTF-8 output
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$platform = "Windows"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir
$projectName = "xxsy"
$env:COMPOSE_PROJECT_NAME = $projectName
$userDist = Join-Path $scriptDir "frontend/user/dist"
$adminDist = Join-Path $scriptDir "frontend/admin/dist"
$maxRetries = 5
$retryInterval = 5

function Test-DockerEngine {
    $ErrorActionPreference = "SilentlyContinue"
    try {
        docker info *> $null
        return $LASTEXITCODE -eq 0
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

    throw "[$platform] Docker Compose not found. Please install Docker Desktop or docker-compose."
}

try {
    $compose = Get-ComposeCommand
} catch {
    Write-Error $_.Exception.Message
    exit 1
}

# Clean up frontend build artifacts
Write-Host "[$platform] Cleaning up frontend build artifacts..." -ForegroundColor Cyan
if (Test-Path $userDist) { Remove-Item -Recurse -Force $userDist -ErrorAction SilentlyContinue }
if (Test-Path $adminDist) { Remove-Item -Recurse -Force $adminDist -ErrorAction SilentlyContinue }

if (-not (Test-DockerEngine)) {
    Write-Host "Docker is not running. Attempting to start Docker Desktop..."
    try {
        # Best-effort attempt to find and start Docker Desktop
        $dockerPath = (Get-Item "C:\Program Files\Docker\Docker\Docker Desktop.exe" -ErrorAction SilentlyContinue).FullName
        if ($dockerPath) {
            Start-Process -FilePath $dockerPath -ErrorAction SilentlyContinue
        } else {
            # Fallback to starting by app name
            Start-Process "Docker Desktop" -ErrorAction SilentlyContinue
        }
    } catch {
        # Silently continue, the check below will determine if it worked
    }

    Write-Host "Waiting for Docker daemon to start... (max 60s)"
    $wait = 0
    while ($wait -lt 12) { # 12 * 5s = 60s
        if (Test-DockerEngine) {
            break
        }
        Start-Sleep -Seconds 5
        $wait++
    }

    if (-not (Test-DockerEngine)) {
        Write-Host "Failed to start Docker. Please ensure Docker Desktop is installed and start it manually."
        exit 1
    }
    Write-Host "Docker started successfully." -ForegroundColor Green
}

function Invoke-ComposeCommand {
    param(
        [Parameter(Position=0, ValueFromRemainingArguments=$true)]
        [object[]]$DockerArguments
    )

    $cmdArgs = @()
    if ($compose.Prefix) {
        $cmdArgs += $compose.Prefix
    }
    
    # Flatten nested arrays if any
    foreach ($arg in $DockerArguments) {
        if ($arg -is [System.Collections.IEnumerable] -and $arg -isnot [string]) {
            $cmdArgs += $arg
        } else {
            $cmdArgs += $arg
        }
    }

    # Debug: Print the exact command being executed
    # Write-Host "Running: & $($compose.Executable) $cmdArgs" -ForegroundColor DarkGray

    & $compose.Executable $cmdArgs
}

function Ensure-MySqlImage {
    docker image inspect mysql:8.4 *> $null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[$platform] 已检测到本地 MySQL 镜像 mysql:8.4，优先使用本地镜像。" -ForegroundColor Green
        return
    }

    Write-Host "[$platform] 本地未找到 MySQL 镜像 mysql:8.4，开始拉取最新镜像..." -ForegroundColor Cyan
    docker pull mysql:8.4
    if ($LASTEXITCODE -ne 0) {
        throw "[$platform] 拉取 MySQL 镜像失败，请检查 Docker 网络或镜像源配置。"
    }
}

Ensure-MySqlImage

$composeArgs = @("up", "-d")
if ($Rebuild.IsPresent) {
    $composeArgs += "--build"
}

Write-Host "[$platform] Starting Education Platform using $($compose.Display)..." -ForegroundColor Cyan
Invoke-ComposeCommand $composeArgs
if ($LASTEXITCODE -ne 0) {
    Write-Error "Startup failed. Please check Docker Compose configuration."
    exit $LASTEXITCODE
}

$attempt = 1
while ($attempt -le $maxRetries) {
    Write-Host "[$platform] Ensuring backend container is ready (Attempt $attempt/$maxRetries)..." -ForegroundColor Cyan
    
    # Check backend container status
    Invoke-ComposeCommand "up", "-d", "backend"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[$platform] Backend started successfully." -ForegroundColor Green
        break
    }
    
    if ($attempt -eq $maxRetries) {
        Write-Error "[$platform] Backend failed to start after $maxRetries attempts. Please check database or backend logs."
        exit 1
    }

    Write-Host "[$platform] Backend check failed. Retrying in ${retryInterval}s..." -ForegroundColor Yellow
    Start-Sleep -Seconds $retryInterval
    $attempt++
}

Write-Host @"

Services started:
- MySQL:        3306 (internal access)
- Backend API:  http://localhost:28964
- Admin Portal: http://localhost:18964
- User Portal:  http://localhost:8964

Use '$($compose.Display) logs -f backend' to view backend logs.
Use '$($compose.Display) down' to stop all services.
"@ -ForegroundColor Green
