Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile("C:\Users\ac.tlili\OneDrive - ONEPOINT\Documents\codeReview App\ai-code-reviewer\build\icon.png")
$bmp = New-Object System.Drawing.Bitmap($img.Width, $img.Height)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::Transparent)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$path.AddEllipse(0, 0, $img.Width, $img.Height)
$brush = New-Object System.Drawing.TextureBrush($img)
$g.FillPath($brush, $path)
$bmp.Save("C:\Users\ac.tlili\OneDrive - ONEPOINT\Documents\codeReview App\ai-code-reviewer\build\icon_round.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Save("C:\Users\ac.tlili\OneDrive - ONEPOINT\Documents\codeReview App\ai-code-reviewer\public\icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
$img.Dispose()
$g.Dispose()
$bmp.Dispose()
$brush.Dispose()
