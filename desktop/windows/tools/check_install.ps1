param([string]$Phase = "install")
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Setup = Get-ChildItem (Join-Path $Root "dist") -Filter "AuteurFrame-Setup-*.exe" | Select-Object -First 1
$Dir = Join-Path $env:USERPROFILE "AuteurFrame-QA-install"
$Data = Join-Path $env:USERPROFILE "AuteurFrame-QA-data"
$Log = Join-Path $Root "build\install-check.log"

if ($Phase -eq "install") {
    if (Test-Path $Dir) { Remove-Item -Recurse -Force $Dir }
    $t = Get-Date
    $p = Start-Process $Setup.FullName -ArgumentList "/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART", "/CURRENTUSER", "/DIR=`"$Dir`"", "/LOG=`"$Log`"" -Wait -PassThru
    "install exit $($p.ExitCode) in $([math]::Round(((Get-Date) - $t).TotalSeconds))s"
    "installed size $([math]::Round((Get-ChildItem $Dir -Recurse -File | Measure-Object -Sum Length).Sum / 1MB)) MB"
    $lnk = Join-Path ([Environment]::GetFolderPath("Programs")) "AuteurFrame\AuteurFrame.lnk"
    "start menu shortcut: $(Test-Path $lnk)"
    $u = Get-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*" | Where-Object { $_.DisplayName -eq "AuteurFrame" }
    "uninstall entry: $($u.DisplayName) $($u.DisplayVersion) by $($u.Publisher)"
    if (Test-Path $Data) { Remove-Item -Recurse -Force $Data }
    $s = Start-Process (Join-Path $Dir "AuteurFrame.exe") -ArgumentList "--smoke-test", "--data-dir", "`"$Data`"" -Wait -PassThru
    "installed smoke exit $($s.ExitCode): $(Get-Content (Join-Path $Data 'logs\smoke.txt'))"
}
elseif ($Phase -eq "uninstall") {
    $un = Join-Path $Dir "unins000.exe"
    $p = Start-Process $un -ArgumentList "/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART" -Wait -PassThru
    Start-Sleep -Seconds 3
    "uninstall exit $($p.ExitCode)"
    "install folder left: $(if (Test-Path $Dir) { (Get-ChildItem $Dir -Recurse | Measure-Object).Count } else { 'removed' })"
    $lnk = Join-Path ([Environment]::GetFolderPath("Programs")) "AuteurFrame"
    "start menu folder left: $(Test-Path $lnk)"
    $u = Get-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*" -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -eq "AuteurFrame" }
    "uninstall entry left: $([bool]$u)"
    "processes left: $((Get-Process | Where-Object { $_.Path -like "$Dir*" }).Count)"
}
