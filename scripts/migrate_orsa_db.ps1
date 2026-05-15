param(
  [string]$SourceHost = "127.0.0.1",
  [int]$SourcePort = 5432,
  [string]$SourceDb = "Orsa_Solvency",
  [string]$SourceUser = "postgres",
  [string]$SourcePassword = "abc123",
  [string]$DumpFile = "orsa_db.dump",
  [string]$TargetDb = "orsa_db"
)

$ErrorActionPreference = "Stop"

$pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
if (-not $pgDump) {
  $pgDump = Get-Command "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" -ErrorAction SilentlyContinue
}
if (-not $pgDump) {
  throw "pg_dump not found. Install PostgreSQL client tools or add them to PATH."
}

$pgRestore = Get-Command pg_restore -ErrorAction SilentlyContinue
if (-not $pgRestore) {
  $pgRestore = Get-Command "C:\Program Files\PostgreSQL\18\bin\pg_restore.exe" -ErrorAction SilentlyContinue
}

Write-Host "==> Dumping $SourceDb from ${SourceHost}:$SourcePort into $DumpFile"
$env:PGPASSWORD = $SourcePassword
& $pgDump.Path -h $SourceHost -p $SourcePort -U $SourceUser -d $SourceDb -Fc -f $DumpFile

Write-Host "==> Restoring into docker compose db (service: db, database: $TargetDb)"
for ($i = 0; $i -lt 30; $i++) {
  docker compose exec -T db pg_isready -U postgres *> $null
  if ($LASTEXITCODE -eq 0) { break }
  Start-Sleep -Seconds 2
}
if ($LASTEXITCODE -ne 0) {
  throw "Postgres container is not ready"
}
$exists = docker compose exec -T db psql -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$TargetDb'"
if (-not ($exists -match "1")) {
  docker compose exec -T db psql -U postgres -d postgres -c "CREATE DATABASE $TargetDb"
}

docker compose cp $DumpFile "db:/tmp/$DumpFile"
docker compose exec -T db pg_restore -U postgres -d $TargetDb --clean --if-exists --no-owner --no-privileges "/tmp/$DumpFile"

Write-Host "==> Done. Verify with: docker compose exec -T db psql -U postgres -d $TargetDb -c '\dt'"

