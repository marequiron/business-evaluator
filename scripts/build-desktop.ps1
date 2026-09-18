<#
build-desktop.ps1 - Windows desktop build with the MSVC + Rust environment loaded.

Run from the repo root:
  .\scripts\build-desktop.ps1               - release build (NSIS installer)
  .\scripts\build-desktop.ps1 -Dev          - dev build (serves on :4173)
  .\scripts\build-desktop.ps1 -Probe        - release exe with the WebView2 DevTools
                                              port baked in for runtime smoke probing
  .\scripts\build-desktop.ps1 -Probe -Port 9333   (default port: 9222)

-Probe temporarily edits src-tauri\tauri.conf.json to add
additionalBrowserArgs = --remote-debugging-port=<port> to the main window, builds
with --no-bundle (binaries only), then RESTORES the original config even if the
build fails. Always leaves the tree clean and devtools-free.
Requirements: Rust toolchain (rustup), Visual Studio 2022 Build Tools with the
C++ workload, Node.js >= 18.
#>
param([switch]$Dev, [switch]$Probe, [string]$Port = "9222")

# "Stop" makes PowerShell 5.1 treat native stderr output (tauri writes its
# "Info ..." logs to stderr) as a terminating NativeCommandError, killing the
# build. Keep it Continue and check $LASTEXITCODE explicitly instead.
$ErrorActionPreference = "Continue"

$cargoBin = Join-Path $env:USERPROFILE ".cargo\bin"
if (Test-Path (Join-Path $cargoBin "cargo.exe")) {
  if ($env:PATH -notlike "*$cargoBin*") { $env:PATH = "$cargoBin;$env:PATH" }
}

$vcvars = "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
if (Test-Path $vcvars) {
  $env_lines = cmd /c "`"$vcvars`" >nul 2>&1 && set"
  foreach ($line in $env_lines) {
    if ($line -match '^([^=]+)=(.*)$') {
      [Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process")
    }
  }
} else {
  Write-Warning "vcvars64.bat not found - MSVC linker may not be on PATH."
}

if ($Dev) { npm run app:dev; exit $LASTEXITCODE }

if ($Probe) {
  $conf = Join-Path $PSScriptRoot "..\src-tauri\tauri.conf.json"
  $backup = $conf + ".probe-backup.json"
  Copy-Item -LiteralPath $conf -Destination $backup -Force
  $code = 1
  try {
    $cfg = Get-Content -LiteralPath $conf -Raw | ConvertFrom-Json
    $window = @($cfg.app.windows)[0]
    Add-Member -InputObject $window -NotePropertyName "label" -NotePropertyValue "main" -Force
    Add-Member -InputObject $window -NotePropertyName "additionalBrowserArgs" -NotePropertyValue "--remote-debugging-port=$Port" -Force
    $cfg | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $conf -Encoding ascii
    Write-Host "Probe config enabled: WebView2 DevTools on port $Port"
    npm run app:build:no-bundle
    $code = $LASTEXITCODE
  }
  finally {
    Move-Item -LiteralPath $backup -Destination $conf -Force
    Write-Host "Probe config restored (tauri.conf.json is back to normal)."
  }
  exit $code
}

npm run app:build
exit $LASTEXITCODE