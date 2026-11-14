param([int]$Wait = 40)
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing, System.Windows.Forms
$Dir = Join-Path $env:USERPROFILE "AuteurFrame-QA-install"
$Data = Join-Path $env:USERPROFILE "AuteurFrame-QA-data"
$Out = Join-Path (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)) "build"
$app = Start-Process (Join-Path $Dir "AuteurFrame.exe") -ArgumentList "--data-dir", "`"$Data`"" -PassThru
Start-Sleep -Seconds $Wait
$app.Refresh()
"window title: $($app.MainWindowTitle)"
$b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($b.Location, [System.Drawing.Point]::Empty, $b.Size)
$bmp.Save((Join-Path $Out "ui-check.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
$children = Get-Process | Where-Object { $_.Path -like "$Dir*" } | Group-Object Name | ForEach-Object { "$($_.Name) x$($_.Count)" }
"running while open: $($children -join ', ')"
$null = $app.CloseMainWindow()
$app.WaitForExit(30000) | Out-Null
Start-Sleep -Seconds 4
"launcher exited: $($app.HasExited)"
"processes left after close: $((Get-Process | Where-Object { $_.Path -like "$Dir*" }).Count)"
Get-Content (Join-Path $Data "logs\launcher.log") -Tail 6
