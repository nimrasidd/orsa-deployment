param(
  [string]$SourceHost = "128.1.50.163",
  [int]$SourcePort = 5432,
  [string]$SourceDb = "orsa_db",  
  [string]$SourceUser = "postgres",
  [string]$SourcePassword = "password123",
  [string]$DumpFile = "orsa_db.dump"
)

$ErrorActionPreference = "Stop"

Write-Host "==> Dumping $SourceDb from $SourceHost:$SourcePort into $DumpFile"
docker run --rm `
  -e "PGPASSWORD=$SourcePassword" `
  -v "${PWD}:/work" `
  postgres:16 `
  pg_dump -h $SourceHost -p $SourcePort -U $SourceUser -d $SourceDb -Fc -f "/work/$DumpFile"

Write-Host "==> Restoring into docker compose db (service: db, database: orsa_db)"
docker compose exec -T db sh -lc "pg_restore -U postgres -d orsa_db --clean --if-exists --no-owner --no-privileges" < $DumpFile

Write-Host "==> Done. Verify with: docker compose exec -T db psql -U postgres -d orsa_db -c '\dt'"

