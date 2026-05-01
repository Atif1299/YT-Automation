# Downloads the latest Windows NSIS installer from GitHub Releases and runs it.
# Usage (after this file is on the web or in your repo):
#   powershell -ExecutionPolicy Bypass -c "irm https://raw.githubusercontent.com/OWNER/REPO/BRANCH/scripts/install-windows.ps1 | iex"
#
# Or run locally: powershell -ExecutionPolicy Bypass -File .\scripts\install-windows.ps1

param(
  [string] $Owner = "Atif1299",
  [string] $Repo = "YT-Automation"
)

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$api = "https://api.github.com/repos/$Owner/$Repo/releases/latest"
$headers = @{ "User-Agent" = "YT-Commenting-Installer" }

Write-Host "Fetching latest release from $Owner/$Repo ..."
$release = Invoke-RestMethod -Uri $api -Headers $headers

# Prefer NSIS setup exe (electron-builder default name pattern)
$asset = $release.assets | Where-Object {
  $_.name -match '\.exe$' -and ($_.name -match 'Setup' -or $_.name -match 'setup')
} | Select-Object -First 1

if (-not $asset) {
  $asset = $release.assets | Where-Object { $_.name -match '\.exe$' } | Select-Object -First 1
}

if (-not $asset) {
  throw "No .exe installer found in latest GitHub release. Publish a Windows build first."
}

$out = Join-Path $env:TEMP $asset.name
Write-Host "Downloading $($asset.name) ..."
Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $out -UseBasicParsing

Write-Host "Starting installer..."
Start-Process -FilePath $out -Wait
