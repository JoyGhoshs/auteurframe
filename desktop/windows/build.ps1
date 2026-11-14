param(
    [string]$AppSource = "",
    [string]$Version = "",
    [switch]$SkipInstaller,
    [switch]$Clean
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Pins = Get-Content (Join-Path $Root "versions.json") -Raw | ConvertFrom-Json
if (-not $AppSource) { $AppSource = $Pins.app_source }
if (-not $AppSource) { $AppSource = (Resolve-Path (Join-Path $Root "..\..")).Path }
if (-not (Test-Path (Join-Path $AppSource "run.py"))) { throw "AuteurFrame source not found at $AppSource; pass -AppSource <path to the repository>" }
if (-not $Version) { $Version = $Pins.installer_version }
$Cache = Join-Path $Root "cache"
$Build = Join-Path $Root "build"
$Stage = Join-Path $Build "AuteurFrame"
$Dist = Join-Path $Root "dist"
$Work = Join-Path $Build "work"

$Curl = Join-Path $env:WINDIR "System32\curl.exe"
$Tar = Join-Path $env:WINDIR "System32\tar.exe"

function Step($text) { Write-Host ""; Write-Host "== $text" -ForegroundColor Cyan }
function Run($file, [string[]]$arguments, $cwd = $null) {
    if ($cwd) { Push-Location $cwd }
    try {
        & $file @arguments
        if ($LASTEXITCODE -ne 0) { throw "$file $($arguments -join ' ') failed with exit code $LASTEXITCODE" }
    }
    finally { if ($cwd) { Pop-Location } }
}
function Sha256($path) { (Get-FileHash -Algorithm SHA256 $path).Hash.ToLower() }
function Fetch($name, $pin) {
    New-Item -ItemType Directory -Force $Cache | Out-Null
    $leaf = [IO.Path]::GetFileName(([Uri]$pin.url).AbsolutePath)
    if (-not $leaf -or $leaf -notmatch '\.') { $leaf = "$name.bin" }
    if ($name -eq "webview2_bootstrapper") { $leaf = "MicrosoftEdgeWebview2Setup.exe" }
    $file = Join-Path $Cache $leaf
    if (-not (Test-Path $file)) {
        Write-Host "   downloading $($pin.url)"
        & $Curl -L --fail --retry 3 --silent --show-error -o "$file.part" $pin.url
        if ($LASTEXITCODE -ne 0) { throw "download failed: $($pin.url)" }
        Move-Item "$file.part" $file
    }
    $actual = Sha256 $file
    $expected = "$($pin.sha256)".ToLower()
    if (-not $expected -and $pin.sha256_url) {
        $expected = ((& $Curl -L --silent --fail $pin.sha256_url) -split '\s+')[0].ToLower()
    }
    if ($expected -and $actual -ne $expected) { Remove-Item $file; throw "checksum mismatch for $name ($actual, expected $expected)" }
    Write-Host "   $name $($pin.version) sha256 $actual" -ForegroundColor DarkGray
    return @{ File = $file; Sha = $actual }
}
function Unzip($zip, $dest) {
    New-Item -ItemType Directory -Force $dest | Out-Null
    & $Tar -xf $zip -C $dest
    if ($LASTEXITCODE -ne 0) { throw "could not extract $zip" }
}

if ($Clean -and (Test-Path $Build)) { Remove-Item -Recurse -Force $Build }
New-Item -ItemType Directory -Force $Stage, $Dist, $Work | Out-Null
$manifest = [ordered]@{ product = "AuteurFrame"; installer_version = $Version; built = (Get-Date).ToString("s"); components = [ordered]@{} }

Step "Application source"
$app = Join-Path $Stage "app"
if (Test-Path $app) { Remove-Item -Recurse -Force $app }
& robocopy.exe $AppSource $app /MIR /NFL /NDL /NJH /NJS /NP /XD .git .github docker desktop tests node_modules vendor __pycache__ .pytest_cache /XF *.pyc *.log | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed ($LASTEXITCODE)" }
$release = Get-Content (Join-Path $app "release.json") -Raw | ConvertFrom-Json
$manifest.components.auteurframe = $release.version
Write-Host "   AuteurFrame $($release.version) from $AppSource"

Step "Runtimes"
$py = Fetch "python" $Pins.runtimes.python
$node = Fetch "node" $Pins.runtimes.node
$ff = Fetch "ffmpeg" $Pins.runtimes.ffmpeg
$cr = Fetch "chrome" $Pins.runtimes.chrome
$wv = Fetch "webview2_bootstrapper" $Pins.runtimes.webview2_bootstrapper
foreach ($k in "python", "node", "ffmpeg", "chrome") { $manifest.components[$k] = $Pins.runtimes.$k.version }

$rt = Join-Path $Stage "runtime"
if (Test-Path $rt) { Remove-Item -Recurse -Force $rt }
New-Item -ItemType Directory -Force $rt | Out-Null

Step "Python $($Pins.runtimes.python.version) (embedded) and packages"
$pyDir = Join-Path $rt "python"
Unzip $py.File $pyDir
$pth = Get-ChildItem $pyDir -Filter "python3*._pth" | Select-Object -First 1
$zipName = (Get-ChildItem $pyDir -Filter "python3*.zip" | Select-Object -First 1).Name
Set-Content -Encoding ascii $pth.FullName "$zipName`r`n.`r`nLib\site-packages`r`n..\..\app`r`nimport site`r`n"
$site = Join-Path $pyDir "Lib\site-packages"
New-Item -ItemType Directory -Force $site | Out-Null
$pyParts = $Pins.runtimes.python.version -split '\.'
$pyVer = "$($pyParts[0]).$($pyParts[1])"
$pyAbi = "cp$($pyParts[0])$($pyParts[1])"
Run "py.exe" @("-3.13", "-m", "pip", "install", "--disable-pip-version-check", "--no-cache-dir", "--only-binary=:all:", "--platform", "win_amd64",
    "--python-version", $pyVer, "--implementation", "cp", "--abi", $pyAbi, "--target", $site, "-r", (Join-Path $app "requirements.txt"))
Get-ChildItem $site -Recurse -Directory -Filter "__pycache__" | Remove-Item -Recurse -Force
$freeze = Join-Path $Work "freeze.py"
Set-Content -Encoding ascii $freeze "import importlib.metadata as m`nprint('\n'.join(sorted(d.metadata['Name'] + '==' + d.version for d in m.distributions())))`n"
$frozen = & (Join-Path $pyDir "python.exe") $freeze
if ($LASTEXITCODE -ne 0) { throw "embedded python could not list packages" }
$frozen | Set-Content -Encoding utf8 (Join-Path $Stage "python-packages.txt")
Write-Host "   $(($frozen | Measure-Object).Count) packages installed"
foreach ($dll in "msvcp140.dll", "msvcp140_1.dll", "msvcp140_2.dll", "vcruntime140.dll", "vcruntime140_1.dll", "concrt140.dll") {
    $src = Join-Path $env:WINDIR "System32\$dll"
    if ((Test-Path $src) -and -not (Test-Path (Join-Path $pyDir $dll))) { Copy-Item $src $pyDir }
}

Step "Node $($Pins.runtimes.node.version)"
$nodeWork = Join-Path $Work "node"
if (Test-Path $nodeWork) { Remove-Item -Recurse -Force $nodeWork }
Unzip $node.File $nodeWork
$nodeHome = Get-ChildItem $nodeWork -Directory | Select-Object -First 1
New-Item -ItemType Directory -Force (Join-Path $rt "node") | Out-Null
Copy-Item (Join-Path $nodeHome.FullName "node.exe") (Join-Path $rt "node")
Copy-Item (Join-Path $nodeHome.FullName "LICENSE") (Join-Path $rt "node\LICENSE")
$nodeExe = Join-Path $nodeHome.FullName "node.exe"
$npmCli = Join-Path $nodeHome.FullName "node_modules\npm\bin\npm-cli.js"
$env:npm_config_update_notifier = "false"
$env:npm_config_fund = "false"
$env:npm_config_audit = "false"
Run $nodeExe @($npmCli, "ci", "--no-progress") $app
Run $nodeExe @($npmCli, "run", "vendor") $app
Run $nodeExe @($npmCli, "prune", "--omit=dev", "--no-progress") $app
if (-not (Test-Path (Join-Path $app "web\vendor\gsap.bundle.js"))) { throw "web/vendor was not built" }

Step "FFmpeg $($Pins.runtimes.ffmpeg.version)"
$ffWork = Join-Path $Work "ffmpeg"
if (Test-Path $ffWork) { Remove-Item -Recurse -Force $ffWork }
Unzip $ff.File $ffWork
$ffHome = Get-ChildItem $ffWork -Directory | Select-Object -First 1
New-Item -ItemType Directory -Force (Join-Path $rt "ffmpeg") | Out-Null
Copy-Item (Join-Path $ffHome.FullName "bin\ffmpeg.exe"), (Join-Path $ffHome.FullName "bin\ffprobe.exe") (Join-Path $rt "ffmpeg")
Copy-Item (Join-Path $ffHome.FullName "LICENSE") (Join-Path $rt "ffmpeg\LICENSE")
if (Test-Path (Join-Path $ffHome.FullName "README.txt")) { Copy-Item (Join-Path $ffHome.FullName "README.txt") (Join-Path $rt "ffmpeg\BUILD-README.txt") }

Step "Chrome for Testing $($Pins.runtimes.chrome.version)"
$crWork = Join-Path $Work "chrome"
if (Test-Path $crWork) { Remove-Item -Recurse -Force $crWork }
Unzip $cr.File $crWork
Move-Item (Join-Path $crWork "chrome-win64") (Join-Path $rt "chrome")

Step "Launcher"
Run "dotnet" @("build", (Join-Path $Root "launcher\AuteurFrame.csproj"), "-c", "Release", "-nologo", "-v", "q", "-p:Version=$Version", "-p:FileVersion=$Version.0")
$bin = Join-Path $Root "launcher\bin\Release\net48"
foreach ($f in "AuteurFrame.exe", "AuteurFrame.exe.config", "Microsoft.Web.WebView2.Core.dll", "Microsoft.Web.WebView2.WinForms.dll", "WebView2Loader.dll") {
    Copy-Item (Join-Path $bin $f) $Stage -Force
}
Copy-Item (Join-Path $Root "assets\AuteurFrame.ico") $Stage -Force

Step "Licences and notices"
$lic = Join-Path $Stage "licenses"
New-Item -ItemType Directory -Force $lic | Out-Null
foreach ($f in "LICENSE", "LICENSE-EXCEPTIONS.md", "NOTICE.txt", "COMMERCIAL.md", "THIRD_PARTY_NOTICES.md") {
    if (Test-Path (Join-Path $app $f)) { Copy-Item (Join-Path $app $f) $lic -Force }
}
Copy-Item (Join-Path $pyDir "LICENSE.txt") (Join-Path $lic "python-LICENSE.txt") -Force
Copy-Item (Join-Path $rt "node\LICENSE") (Join-Path $lic "node-LICENSE.txt") -Force
Copy-Item (Join-Path $rt "ffmpeg\LICENSE") (Join-Path $lic "ffmpeg-LICENSE.txt") -Force
$crLic = Get-ChildItem (Join-Path $rt "chrome") -Filter "LICENSE*" | Select-Object -First 1
if ($crLic) { Copy-Item $crLic.FullName (Join-Path $lic "chrome-for-testing-LICENSE.html") -Force }
$wvLic = Get-ChildItem (Join-Path $env:USERPROFILE ".nuget\packages\microsoft.web.webview2") -Recurse -Filter "LICENSE*" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($wvLic) { Copy-Item $wvLic.FullName (Join-Path $lic "webview2-sdk-LICENSE.txt") -Force }
Copy-Item (Join-Path $Root "installer\DESKTOP-NOTICES.txt") $lic -Force

Step "Smoke test"
$smokeData = Join-Path $Work "smoke-data"
if (Test-Path $smokeData) { Remove-Item -Recurse -Force $smokeData }
$p = Start-Process -FilePath (Join-Path $Stage "AuteurFrame.exe") -ArgumentList @("--smoke-test", "--data-dir", "`"$smokeData`"") -Wait -PassThru
$smoke = Get-Content (Join-Path $smokeData "logs\smoke.txt") -ErrorAction SilentlyContinue
if ($p.ExitCode -ne 0 -or "$smoke" -notmatch '^ok') { throw "smoke test failed (exit $($p.ExitCode)): see $smokeData\logs" }
Write-Host "   backend started and answered /api/health"

$size = (Get-ChildItem $Stage -Recurse -File | Measure-Object -Sum Length).Sum
$manifest.stage_bytes = $size
$manifest | ConvertTo-Json -Depth 4 | Set-Content -Encoding utf8 (Join-Path $Stage "desktop-build.json")
Write-Host "   staged $([math]::Round($size / 1MB)) MB in $Stage"

if ($SkipInstaller) { return }

Step "Installer"
$iscc = @("${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe", "$env:ProgramFiles\Inno Setup 6\ISCC.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $iscc) { throw "Inno Setup 6 (ISCC.exe) not found" }
Write-Host "   compressing the staged app into AuteurFrame-Setup-$Version.exe (maximum LZMA2); this takes 5 to 15 minutes and prints nothing until it is done"
$compressStart = Get-Date
Copy-Item $wv.File (Join-Path $Work "MicrosoftEdgeWebview2Setup.exe") -Force
Run $iscc @("/Q", "/DAppVersion=$Version", "/DCoreVersion=$($release.version)", "/DStageDir=$Stage", "/DRedistDir=$Work", "/DAssetsDir=$(Join-Path $Root 'assets')",
    "/DOutputDir=$Dist", (Join-Path $Root "installer\AuteurFrame.iss"))
$setup = Join-Path $Dist "AuteurFrame-Setup-$Version.exe"
Write-Host ("   compressed in {0:n1} minutes" -f ((Get-Date) - $compressStart).TotalMinutes)
$hash = Sha256 $setup
"$hash  AuteurFrame-Setup-$Version.exe" | Set-Content -Encoding ascii "$setup.sha256"
Write-Host ""
Write-Host "Built $setup ($([math]::Round((Get-Item $setup).Length / 1MB)) MB)" -ForegroundColor Green
Write-Host "SHA256 $hash"
