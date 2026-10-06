# Rasterize the code-defined calendar/check mark for Expo's launcher and splash assets.
Add-Type -AssemblyName System.Drawing
$workspace = Split-Path -Parent $PSScriptRoot
$bitmap = New-Object System.Drawing.Bitmap 1024,1024
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#E7F2FF'))
function RoundedPath([int]$x, [int]$y, [int]$width, [int]$height, [int]$radius) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $diameter = $radius * 2
  $path.AddArc($x, $y, $diameter, $diameter, 180, 90)
  $path.AddArc(($x + $width - $diameter), $y, $diameter, $diameter, 270, 90)
  $path.AddArc(($x + $width - $diameter), ($y + $height - $diameter), $diameter, $diameter, 0, 90)
  $path.AddArc($x, ($y + $height - $diameter), $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return ,$path
}
$body = RoundedPath 208 236 608 592 115
$rectangle = New-Object System.Drawing.Rectangle 208,236,608,592
$gradient = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rectangle,([System.Drawing.ColorTranslator]::FromHtml('#38A7FF')),([System.Drawing.ColorTranslator]::FromHtml('#0064F5')),45
$graphics.FillPath($gradient, $body)
$paper = RoundedPath 286 374 452 367 52
$graphics.FillPath([System.Drawing.Brushes]::White, $paper)
$pen = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml('#075CD9')),57
$pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
$graphics.DrawLine($pen,359,204,359,316)
$graphics.DrawLine($pen,665,204,665,316)
$pen.Color = [System.Drawing.ColorTranslator]::FromHtml('#0878FF')
$points = [System.Drawing.Point[]]@((New-Object System.Drawing.Point 394,554),(New-Object System.Drawing.Point 476,636),(New-Object System.Drawing.Point 632,464))
$graphics.DrawLines($pen, $points)
$bitmap.Save((Join-Path $workspace 'assets/images/planly-icon.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$pen.Dispose(); $paper.Dispose(); $body.Dispose(); $gradient.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
