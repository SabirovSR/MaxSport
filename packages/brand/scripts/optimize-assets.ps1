# Re-encodes the generated brand photographs for web delivery.
#
# The image generator emits multi-megabyte PNGs; the hero is the landing page's
# LCP element, so these ship as JPEG instead. Run from the repository root after
# regenerating any source art; the optimized output is what gets committed.
# The mark is not handled here, see render-mark.ps1.
#
#   pwsh packages/brand/scripts/optimize-assets.ps1

Add-Type -AssemblyName System.Drawing

$assets = Join-Path $PSScriptRoot "..\assets" | Resolve-Path

function Resize-Image {
    param(
        [string]$Path,
        [int]$MaxEdge
    )
    $source = [System.Drawing.Bitmap]::FromFile($Path)
    try {
        $scale = [Math]::Min(
            $MaxEdge / [double]$source.Width,
            $MaxEdge / [double]$source.Height
        )
        if ($scale -ge 1) { $scale = 1 }
        $width = [int][Math]::Round($source.Width * $scale)
        $height = [int][Math]::Round($source.Height * $scale)

        $target = New-Object System.Drawing.Bitmap($width, $height)
        $graphics = [System.Drawing.Graphics]::FromImage($target)
        $graphics.InterpolationMode = "HighQualityBicubic"
        $graphics.SmoothingMode = "HighQuality"
        $graphics.PixelOffsetMode = "HighQuality"
        $graphics.CompositingQuality = "HighQuality"
        $graphics.DrawImage($source, 0, 0, $width, $height)
        $graphics.Dispose()
        return $target
    }
    finally {
        $source.Dispose()
    }
}

function Save-Jpeg {
    param(
        [System.Drawing.Bitmap]$Bitmap,
        [string]$Path,
        [int]$Quality
    )
    $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
        Where-Object { $_.MimeType -eq "image/jpeg" }
    $params = New-Object System.Drawing.Imaging.EncoderParameters(1)
    $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
        [System.Drawing.Imaging.Encoder]::Quality, [long]$Quality
    )
    $Bitmap.Save($Path, $codec, $params)
    $params.Dispose()
}

# Photographic art. JPEG keeps these an order of magnitude smaller than the
# source PNGs, which matters because the hero image is the LCP element.
$photos = @(
    @{ Name = "hero-court"; MaxEdge = 1600; Quality = 82 },
    @{ Name = "problem-formation"; MaxEdge = 1200; Quality = 82 },
    @{ Name = "problem-clock"; MaxEdge = 1400; Quality = 82 },
    @{ Name = "presence-threshold"; MaxEdge = 1800; Quality = 82 },
    @{ Name = "og-card"; MaxEdge = 1200; Quality = 88 }
)

foreach ($photo in $photos) {
    $source = Join-Path $assets "$($photo.Name).png"
    if (-not (Test-Path $source)) { continue }
    $bitmap = Resize-Image -Path $source -MaxEdge $photo.MaxEdge
    $destination = Join-Path $assets "$($photo.Name).jpg"
    Save-Jpeg -Bitmap $bitmap -Path $destination -Quality $photo.Quality
    $bitmap.Dispose()
    Remove-Item $source -Force
    $kb = [Math]::Round((Get-Item $destination).Length / 1KB)
    Write-Host "$($photo.Name).jpg  ${kb} KB"
}