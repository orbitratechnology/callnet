param(
  [ValidateSet('development', 'preview', 'production')]
  [string]$EasEnvironment = 'development',
  [string]$DopplerProject = 'callnet',
  [string]$DopplerConfig = 'dev_personal',
  [string]$AndroidGoogleServicesPath = './google-services.json',
  [string]$IosGoogleServiceInfoPlistPath = './GoogleService-Info.plist',
  [switch]$SkipPublicEnv
)

$ErrorActionPreference = 'Stop'

function Assert-Command($Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command '$Name' was not found in PATH."
  }
}

function Assert-ExitCode($CommandName) {
  if ($LASTEXITCODE -ne 0) {
    throw "$CommandName failed with exit code $LASTEXITCODE."
  }
}

function Resolve-ProjectPath($Path) {
  if ([System.IO.Path]::IsPathRooted($Path)) {
    return $Path
  }

  return Join-Path (Split-Path -Parent $PSScriptRoot) $Path
}

Assert-Command 'doppler'
Assert-Command 'npx'

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) "callnet-eas-sync-$([guid]::NewGuid().ToString('N'))"
New-Item -ItemType Directory -Path $tempRoot | Out-Null

try {
  if (-not $SkipPublicEnv) {
    $dopplerEnvPath = Join-Path $tempRoot 'doppler.env'
    $publicEnvPath = Join-Path $tempRoot 'eas-public.env'

    $dopplerEnvLines = @(& doppler secrets download --project $DopplerProject --config $DopplerConfig --format env --no-file)
    Assert-ExitCode 'Doppler environment download'
    [System.IO.File]::WriteAllLines($dopplerEnvPath, $dopplerEnvLines, [System.Text.UTF8Encoding]::new($false))

    $publicLines = @(
      Get-Content -LiteralPath $dopplerEnvPath |
        Where-Object { $_ -match '^\s*EXPO_PUBLIC_[A-Z0-9_]+\s*=' }
    )

    if ($publicLines.Count -eq 0) {
      throw "No EXPO_PUBLIC_ variables were found in $DopplerProject/$DopplerConfig."
    }

    [System.IO.File]::WriteAllLines($publicEnvPath, $publicLines, [System.Text.UTF8Encoding]::new($false))
    & npx --yes eas-cli@latest env:push $EasEnvironment --path $publicEnvPath --force
    Assert-ExitCode 'EAS public environment sync'
  }

  $androidPath = Resolve-ProjectPath $AndroidGoogleServicesPath
  $iosPath = Resolve-ProjectPath $IosGoogleServiceInfoPlistPath

  if (-not (Test-Path -LiteralPath $androidPath -PathType Leaf)) {
    throw "Android Google services file was not found: $androidPath"
  }

  if (-not (Test-Path -LiteralPath $iosPath -PathType Leaf)) {
    throw "iOS Google service info plist was not found: $iosPath"
  }

  & npx --yes eas-cli@latest env:set $EasEnvironment --name GOOGLE_SERVICES_JSON --value $androidPath --type file --visibility secret --non-interactive
  Assert-ExitCode 'EAS Android Google services file sync'

  & npx --yes eas-cli@latest env:set $EasEnvironment --name GOOGLE_SERVICE_INFO_PLIST --value $iosPath --type file --visibility secret --non-interactive
  Assert-ExitCode 'EAS iOS Google services file sync'

  Write-Output "Synced EAS environment '$EasEnvironment' from Doppler config '$DopplerProject/$DopplerConfig' and local Google services files."
} finally {
  if (Test-Path -LiteralPath $tempRoot) {
    Remove-Item -LiteralPath $tempRoot -Recurse -Force
  }
}
