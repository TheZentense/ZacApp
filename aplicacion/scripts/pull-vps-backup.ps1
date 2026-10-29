param(
  [string]$SshTarget = 'zacappadmin@77.237.246.163',
  [string]$RemoteRoot = '/home/zacappadmin/backups/zacapp',
  [string]$LocalRoot = "$env:USERPROFILE\ZacApp-Backups"
)

$ErrorActionPreference = 'Stop'

if ($SshTarget -notmatch '^[A-Za-z0-9._-]+@[A-Za-z0-9._-]+$') {
  throw 'El destino SSH no tiene un formato permitido.'
}
if ($RemoteRoot -ne '/home/zacappadmin/backups/zacapp') {
  throw 'La ruta remota debe ser la carpeta privada de respaldos de ZacApp.'
}

New-Item -ItemType Directory -Force -Path $LocalRoot | Out-Null
$latest = (& ssh -o BatchMode=yes $SshTarget "find '$RemoteRoot' -mindepth 1 -maxdepth 1 -type d -name '20??????T??????Z' -printf '%f\n' | sort | tail -n 1").Trim()
if ($LASTEXITCODE -ne 0 -or $latest -notmatch '^20\d{6}T\d{6}Z$') {
  throw 'No fue posible localizar un respaldo completo en el VPS.'
}

$destination = Join-Path $LocalRoot $latest
if (-not (Test-Path -LiteralPath $destination)) {
  & scp -q -r "${SshTarget}:${RemoteRoot}/${latest}" $LocalRoot
  if ($LASTEXITCODE -ne 0) { throw 'No fue posible copiar el respaldo desde el VPS.' }
}

$manifestPath = Join-Path $destination 'SHA256SUMS'
if (-not (Test-Path -LiteralPath $manifestPath)) { throw 'El respaldo no contiene SHA256SUMS.' }

foreach ($line in Get-Content -LiteralPath $manifestPath) {
  if ($line -notmatch '^([a-f0-9]{64})  (.+)$') { throw 'El manifiesto de integridad tiene un formato inválido.' }
  $expected = $matches[1].ToUpperInvariant()
  $fileName = $matches[2]
  if ($fileName -match '[\\/]' -or $fileName -in '.', '..') { throw 'El manifiesto contiene una ruta no permitida.' }
  $filePath = Join-Path $destination $fileName
  if (-not (Test-Path -LiteralPath $filePath)) { throw "Falta el archivo $fileName." }
  $actual = (Get-FileHash -LiteralPath $filePath -Algorithm SHA256).Hash
  if ($actual -ne $expected) { throw "Falló la integridad de $fileName." }
}

Write-Output "Respaldo local verificado: $destination"
