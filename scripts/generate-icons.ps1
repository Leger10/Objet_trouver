# G�n�re les ic�nes PWA du projet depuis une image source carr�e.
# Usage:  powershell -File scripts\generate-icons.ps1 -Source "chemin\vers\logo.png"
#
# Produit dans public\images :
#   icon-192.png          192x192  (fond blanc, marge 6%)
#   icon-512.png          512x512  (fond blanc, marge 6%)
#   icon-maskable-512.png 512x512  (fond blanc, zone de s�curit� Android : contenu � 78%)
#
# IMPORTANT : ne jamais remplacer ces fichiers manuellement par une grande
# image : le manifest d�clare des tailles exactes et Chrome rejette sinon.

param(
    [Parameter(Mandatory = $true)]
    [string]$Source
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

if (-not (Test-Path -LiteralPath $Source)) {
    Write-Error "Fichier source introuvable : $Source"
}

$outDir = Join-Path $PSScriptRoot "..\public\images"

$src = [System.Drawing.Image]::FromFile((Resolve-Path -LiteralPath $Source))
Write-Host "Source : $($src.Width)x$($src.Height)"

function Save-Icon {
    param([int]$Size, [string]$Path, [double]$PadPercent)

    $bmp = New-Object System.Drawing.Bitmap($Size, $Size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = 'HighQuality'
    $g.PixelOffsetMode = 'HighQuality'
    $g.Clear([System.Drawing.Color]::White)

    $drawSize = [int][math]::Floor($Size * (1 - $PadPercent))
    $offset = [int][math]::Floor(($Size - $drawSize) / 2)
    $g.DrawImage($src, $offset, $offset, $drawSize, $drawSize)

    $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose()
    Write-Host "OK $(Split-Path -Leaf $Path)"
}

Save-Icon 192 (Join-Path $outDir "icon-192.png")          0.06
Save-Icon 512 (Join-Path $outDir "icon-512.png")          0.06
Save-Icon 512 (Join-Path $outDir "icon-maskable-512.png") 0.22

$src.Dispose()
Write-Host "`nTermin�. V�rifiez que les tailles correspondent au manifest puis committez."
