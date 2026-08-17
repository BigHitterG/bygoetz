param(
  [Parameter(Mandatory = $true)]
  [string]$InputPath,

  [Parameter(Mandatory = $true)]
  [string]$OutputPath,

  [int]$CropX = 0,
  [int]$CropY = 0,
  [int]$CropWidth = 0,
  [int]$CropHeight = 0,
  [ValidateRange(320, 4000)]
  [int]$MaxLongEdge = 1800,
  [ValidateRange(60, 100)]
  [int]$Quality = 86
)

Add-Type -AssemblyName System.Drawing

$resolvedInput = (Resolve-Path -LiteralPath $InputPath).Path
$resolvedOutput = [System.IO.Path]::GetFullPath($OutputPath)
$outputDirectory = [System.IO.Path]::GetDirectoryName($resolvedOutput)

if ($outputDirectory) {
  [System.IO.Directory]::CreateDirectory($outputDirectory) | Out-Null
}

$source = [System.Drawing.Image]::FromFile($resolvedInput)

try {
  $sourceWidth = if ($CropWidth -gt 0) { $CropWidth } else { $source.Width }
  $sourceHeight = if ($CropHeight -gt 0) { $CropHeight } else { $source.Height }

  if (
    $CropX -lt 0 -or
    $CropY -lt 0 -or
    $sourceWidth -le 0 -or
    $sourceHeight -le 0 -or
    ($CropX + $sourceWidth) -gt $source.Width -or
    ($CropY + $sourceHeight) -gt $source.Height
  ) {
    throw "Crop rectangle is outside the source image bounds."
  }

  $scale = [Math]::Min(1.0, $MaxLongEdge / [double][Math]::Max($sourceWidth, $sourceHeight))
  $targetWidth = [Math]::Max(1, [int][Math]::Round($sourceWidth * $scale))
  $targetHeight = [Math]::Max(1, [int][Math]::Round($sourceHeight * $scale))

  $bitmap = New-Object System.Drawing.Bitmap(
    $targetWidth,
    $targetHeight,
    [System.Drawing.Imaging.PixelFormat]::Format24bppRgb
  )

  try {
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)

    try {
      $graphics.Clear([System.Drawing.Color]::White)
      $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
      $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality

      $sourceRectangle = New-Object System.Drawing.Rectangle($CropX, $CropY, $sourceWidth, $sourceHeight)
      $targetRectangle = New-Object System.Drawing.Rectangle(0, 0, $targetWidth, $targetHeight)
      $graphics.DrawImage($source, $targetRectangle, $sourceRectangle, [System.Drawing.GraphicsUnit]::Pixel)
    }
    finally {
      $graphics.Dispose()
    }

    $jpegEncoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
      Where-Object { $_.MimeType -eq "image/jpeg" } |
      Select-Object -First 1
    $encoderParameters = New-Object System.Drawing.Imaging.EncoderParameters(1)
    $encoderParameters.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
      [System.Drawing.Imaging.Encoder]::Quality,
      [long]$Quality
    )

    try {
      $stream = [System.IO.File]::Open(
        $resolvedOutput,
        [System.IO.FileMode]::Create,
        [System.IO.FileAccess]::Write,
        [System.IO.FileShare]::None
      )

      try {
        $bitmap.Save($stream, $jpegEncoder, $encoderParameters)
      }
      finally {
        $stream.Dispose()
      }
    }
    finally {
      $encoderParameters.Dispose()
    }
  }
  finally {
    $bitmap.Dispose()
  }

  [pscustomobject]@{
    Input = $resolvedInput
    Output = $resolvedOutput
    Width = $targetWidth
    Height = $targetHeight
  }
}
finally {
  $source.Dispose()
}
