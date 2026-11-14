$Dir = Join-Path $env:USERPROFILE "AuteurFrame-QA-install"
$Data = Join-Path $env:USERPROFILE "AuteurFrame-QA-data"
$app = Start-Process (Join-Path $Dir "AuteurFrame.exe") -ArgumentList "--data-dir", "`"$Data`"" -PassThru
foreach ($t in 15, 45, 90) {
    Start-Sleep -Seconds ($t - $(if ($t -eq 15) { 0 } elseif ($t -eq 45) { 15 } else { 45 }))
    $ps = Get-Process | Where-Object { $_.Path -like "$Dir*" }
    $chrome = $ps | Where-Object { $_.Name -eq "chrome" }
    "{0,3}s  chrome {1,3} procs {2,6:N0} MB | all bundled {3,6:N0} MB" -f $t, $chrome.Count, (($chrome | Measure-Object WorkingSet64 -Sum).Sum / 1MB), (($ps | Measure-Object WorkingSet64 -Sum).Sum / 1MB)
}
$null = $app.CloseMainWindow()
$app.WaitForExit(30000) | Out-Null
Start-Sleep -Seconds 3
"left: $((Get-Process | Where-Object { $_.Path -like "$Dir*" }).Count)"
