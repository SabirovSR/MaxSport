# Rasterizes the mark geometry from assets/mark.svg into PNG icon sizes.
#
# The shapes are re-declared here rather than parsed from the SVG, so the two
# files must be edited together. Keeping the rasters generated from the same
# coordinates is what keeps the icon crisp at 16px, where a downscale of the
# large artwork turns to mush.
#
#   pwsh packages/brand/scripts/render-mark.ps1

Add-Type -AssemblyName System.Drawing

$assets = Join-Path $PSScriptRoot "..\assets" | Resolve-Path

$charcoal = [System.Drawing.ColorTranslator]::FromHtml("#1a1a1a")
$white = [System.Drawing.ColorTranslator]::FromHtml("#fafafa")
$slot = [System.Drawing.ColorTranslator]::FromHtml("#474747")
$lime = [System.Drawing.ColorTranslator]::FromHtml("#c8f54a")

function New-RoundedRect {
    param([single]$X, [single]$Y, [single]$W, [single]$H, [single]$R)
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $R * 2
    $path.AddArc($X, $Y, $d, $d, 180, 90)
    $path.AddArc($X + $W - $d, $Y, $d, $d, 270, 90)
    $path.AddArc($X + $W - $d, $Y + $H - $d, $d, $d, 0, 90)
    $path.AddArc($X, $Y + $H - $d, $d, $d, 90, 90)
    $path.CloseFigure()
    return $path
}

function Render-Mark {
    param([int]$Size)

    $bitmap = New-Object System.Drawing.Bitmap($Size, $Size)
    $g = [System.Drawing.Graphics]::FromImage($bitmap)
    $g.SmoothingMode = "AntiAlias"
    $g.InterpolationMode = "HighQualityBicubic"
    $g.PixelOffsetMode = "HighQuality"

    $s = $Size / 512.0
    $g.ScaleTransform($s, $s)

    $backdrop = New-RoundedRect -X 0 -Y 0 -W 512 -H 512 -R 114
    $brush = New-Object System.Drawing.SolidBrush($charcoal)
    $g.FillPath($brush, $backdrop)
    $brush.Dispose()
    $backdrop.Dispose()

    $pen = New-Object System.Drawing.Pen($white, 9)
    $pen.StartCap = "Round"
    $pen.EndCap = "Round"

    $frame = New-RoundedRect -X 52 -Y 80 -W 408 -H 352 -R 19
    $g.DrawPath($pen, $frame)
    $frame.Dispose()

    $g.DrawLine($pen, 256, 80, 256, 108)
    $g.DrawLine($pen, 256, 404, 256, 432)
    $g.DrawArc($pen, 26, 230, 52, 52, -90, 180)
    $g.DrawArc($pen, 434, 230, 52, 52, 90, 180)
    $pen.Dispose()

    $slotBrush = New-Object System.Drawing.SolidBrush($slot)
    $limeBrush = New-Object System.Drawing.SolidBrush($lime)
    foreach ($col in @(86, 206, 326)) {
        foreach ($row in @(146, 266)) {
            $shape = New-RoundedRect -X $col -Y $row -W 100 -H 100 -R 22
            $isFilled = ($col -eq 326 -and $row -eq 266)
            $g.FillPath($(if ($isFilled) { $limeBrush } else { $slotBrush }), $shape)
            $shape.Dispose()
        }
    }
    $slotBrush.Dispose()
    $limeBrush.Dispose()

    $g.Dispose()
    return $bitmap
}

foreach ($size in @(512, 192, 180, 48, 32, 16)) {
    $bitmap = Render-Mark -Size $size
    $path = Join-Path $assets "mark-$size.png"
    $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bitmap.Dispose()
    Write-Host "mark-$size.png"
}
