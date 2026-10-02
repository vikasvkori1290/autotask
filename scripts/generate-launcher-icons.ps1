Add-Type -AssemblyName System.Drawing

function Render-A-Path([float]$scaleX, [float]$scaleY) {
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.FillMode = [System.Drawing.Drawing2D.FillMode]::Alternate

    # Outer polygon of A
    $outerPoints = [System.Drawing.PointF[]]@(
        [System.Drawing.PointF]::new(512.0 * $scaleX, 220.0 * $scaleY),
        [System.Drawing.PointF]::new(798.0 * $scaleX, 760.0 * $scaleY),
        [System.Drawing.PointF]::new(662.0 * $scaleX, 760.0 * $scaleY),
        [System.Drawing.PointF]::new(598.0 * $scaleX, 630.0 * $scaleY),
        [System.Drawing.PointF]::new(426.0 * $scaleX, 630.0 * $scaleY),
        [System.Drawing.PointF]::new(362.0 * $scaleX, 760.0 * $scaleY),
        [System.Drawing.PointF]::new(226.0 * $scaleX, 760.0 * $scaleY)
    )
    $path.AddPolygon($outerPoints)

    # Inner triangle of A
    $innerPoints = [System.Drawing.PointF[]]@(
        [System.Drawing.PointF]::new(512.0 * $scaleX, 370.0 * $scaleY),
        [System.Drawing.PointF]::new(580.0 * $scaleX, 530.0 * $scaleY),
        [System.Drawing.PointF]::new(444.0 * $scaleX, 530.0 * $scaleY)
    )
    $path.AddPolygon($innerPoints)

    return $path
}

function Generate-IconFile([int]$width, [int]$height, [string]$outPath, [string]$mode) {
    $bmp = New-Object System.Drawing.Bitmap $width, $height
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    if ($mode -eq "foreground") {
        $g.Clear([System.Drawing.Color]::Transparent)
        # Scale to 66% inside foreground canvas and center
        $targetSize = [float]($width * 0.66)
        $offsetX = [float](($width - $targetSize) / 2.0)
        $offsetY = [float](($height - $targetSize) / 2.0)
        $scale = [float]($targetSize / 1024.0)

        $g.TranslateTransform($offsetX, $offsetY)
        $path = Render-A-Path $scale $scale
        $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 255, 255))
        $g.FillPath($brush, $path)
        $brush.Dispose()
        $path.Dispose()
    }
    elseif ($mode -eq "round") {
        $g.Clear([System.Drawing.Color]::Transparent)
        # Circular black background
        $bgBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 0, 0, 0))
        $g.FillEllipse($bgBrush, 0, 0, $width, $height)
        $bgBrush.Dispose()

        # Scale A to 68% inside circle
        $targetSize = [float]($width * 0.68)
        $offsetX = [float](($width - $targetSize) / 2.0)
        $offsetY = [float](($height - $targetSize) / 2.0)
        $scale = [float]($targetSize / 1024.0)

        $g.TranslateTransform($offsetX, $offsetY)
        $path = Render-A-Path $scale $scale
        $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 255, 255))
        $g.FillPath($brush, $path)
        $brush.Dispose()
        $path.Dispose()
    }
    else {
        # Square launcher: Solid black background
        $g.Clear([System.Drawing.Color]::FromArgb(255, 0, 0, 0))

        # Scale A to 70%
        $targetSize = [float]($width * 0.70)
        $offsetX = [float](($width - $targetSize) / 2.0)
        $offsetY = [float](($height - $targetSize) / 2.0)
        $scale = [float]($targetSize / 1024.0)

        $g.TranslateTransform($offsetX, $offsetY)
        $path = Render-A-Path $scale $scale
        $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 255, 255))
        $g.FillPath($brush, $path)
        $brush.Dispose()
        $path.Dispose()
    }

    $g.Dispose()
    $dir = Split-Path $outPath -Parent
    if (!(Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Output "Successfully generated: $outPath ($width x $height)"
}

$baseRes = "android/app/src/main/res"

$densities = @(
    @{ name = "mdpi"; size = 48; fgSize = 108 },
    @{ name = "hdpi"; size = 72; fgSize = 162 },
    @{ name = "xhdpi"; size = 96; fgSize = 216 },
    @{ name = "xxhdpi"; size = 144; fgSize = 324 },
    @{ name = "xxxhdpi"; size = 192; fgSize = 432 }
)

foreach ($d in $densities) {
    $folder = Join-Path $baseRes "mipmap-$($d.name)"
    Generate-IconFile $d.size $d.size (Join-Path $folder "ic_launcher.png") "square"
    Generate-IconFile $d.size $d.size (Join-Path $folder "ic_launcher_round.png") "round"
    Generate-IconFile $d.fgSize $d.fgSize (Join-Path $folder "ic_launcher_foreground.png") "foreground"
}

Write-Output "All 15 Android launcher icon mipmap files generated cleanly!"
