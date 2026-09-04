$required = @(
  'FIREBASE_SERVICE_ACCOUNT_EMAIL',
  'FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY',
  'METERED_TURN_API_KEY'
)

foreach ($name in $required) {
  if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name))) {
    throw "Missing injected secret: $name"
  }
}

$tempDir = Join-Path $env:TEMP ('callnet-doppler-sync-' + [Guid]::NewGuid().ToString('N'))
$payloadPath = Join-Path $tempDir 'worker-secrets.json'
$exitCode = 1

New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

try {
  $payload = [ordered]@{
    FIREBASE_SERVICE_ACCOUNT_EMAIL = $env:FIREBASE_SERVICE_ACCOUNT_EMAIL
    FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY = $env:FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY
    METERED_TURN_API_KEY = $env:METERED_TURN_API_KEY
  } | ConvertTo-Json -Compress

  Set-Content -LiteralPath $payloadPath -Value $payload -Encoding utf8
  & bun x wrangler secret bulk $payloadPath --config wrangler.jsonc
  $exitCode = $LASTEXITCODE
}
finally {
  if (Test-Path -LiteralPath $tempDir) {
    Remove-Item -LiteralPath $tempDir -Force -Recurse
  }
}

exit $exitCode
