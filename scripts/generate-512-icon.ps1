$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
$root = Split-Path $PSScriptRoot -Parent
$path = Join-Path $root "build\icon.png"
$s = 512
$b = New-Object System.Drawing.Bitmap $s, $s
$g = [System.Drawing.Graphics]::FromImage($b)
$g.Clear([System.Drawing.Color]::FromArgb(45, 45, 55))
$g.Dispose()
$b.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
$b.Dispose()
Write-Host "Wrote $path (${s}x${s})"
