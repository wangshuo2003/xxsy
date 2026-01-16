# Startup Guide for Education Platform (Windows)

## Prerequisites
- **Docker Desktop** must be installed and running.
- **PowerShell 5.1** or later (standard on Windows 10/11).

## Quick Start
1. Open PowerShell in this directory.
2. Run the startup script:
   ```powershell
   .\start-windows.ps1
   ```
   This script will:
   - Check if Docker is running (and attempt to start it if not).
   - Clean up old frontend build artifacts.
   - Run `docker compose up -d` to start MySQL, Backend, and Frontends.
   - Wait for the backend to be ready.

## Rebuilding
If you have modified `package.json` or `Dockerfile`, run with the rebuild switch:
```powershell
.\start-windows.ps1 -Rebuild
```

## Accessing Services
Once started, you can access:
- **User Portal**: [http://localhost:8964](http://localhost:8964)
- **Admin Portal**: [http://localhost:18964](http://localhost:18964)
- **Backend API**: [http://localhost:28964](http://localhost:28964)

## Troubleshooting
- **Docker not found**: Ensure Docker Desktop is installed and in your PATH.
- **Backend not starting**: Check logs with:
  ```powershell
  docker compose logs -f backend
  ```
- **Database issues**: The database data is persisted in a docker volume `mysql_data`. To reset, run `docker compose down -v` (Warning: this deletes all data).

## Development Notes
- The backend runs on port `28964`.
- Frontend proxies API requests to the backend container.
- Test accounts are available (see `backend/prisma/seed.js` or ask the assistant).
