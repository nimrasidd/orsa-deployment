# Start backend - forces local PostgreSQL from .env (overrides any inherited DATABASE_URL)
$ErrorActionPreference = "Stop"
# Read DATABASE_URL from .env and set it explicitly so it wins over inherited env
$envFile = Join-Path $PSScriptRoot ".env"
$line = Get-Content $envFile | Where-Object { $_ -match "^DATABASE_URL=" -and $_ -notmatch "^#" } | Select-Object -First 1
if ($line) {
    $env:DATABASE_URL = ($line -split "=", 2)[1].Trim()
}
Set-Location $PSScriptRoot
& .\.venv\Scripts\python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
