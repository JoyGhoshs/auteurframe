#ifndef AppVersion
  #define AppVersion "1.2.0"
#endif
#ifndef CoreVersion
  #define CoreVersion AppVersion
#endif
#ifndef StageDir
  #define StageDir "..\build\AuteurFrame"
#endif
#ifndef RedistDir
  #define RedistDir "..\build\work"
#endif
#ifndef AssetsDir
  #define AssetsDir "..\assets"
#endif
#ifndef OutputDir
  #define OutputDir "..\dist"
#endif

[Setup]
AppId={{6E1B9D2A-5C3F-4F7E-9B1A-AF7E2D0C4B51}
AppName=AuteurFrame
AppVersion={#AppVersion}
AppVerName=AuteurFrame {#AppVersion}
AppPublisher=Abdur Rahman Maheer
AppPublisherURL=https://joyghoshs.github.io/Auteur-frameProject/
AppSupportURL=https://github.com/joyghoshs/auteurframe/issues
AppUpdatesURL=https://github.com/joyghoshs/auteurframe/releases
AppCopyright=Copyright (c) 2026 Abdur Rahman Maheer
VersionInfoVersion={#AppVersion}.0
VersionInfoProductName=AuteurFrame
VersionInfoDescription=AuteurFrame setup
VersionInfoProductTextVersion={#AppVersion} (core {#CoreVersion})
DefaultDirName={autopf}\AuteurFrame
DefaultGroupName=AuteurFrame
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0.17763
LicenseFile={#StageDir}\licenses\LICENSE
SetupIconFile={#AssetsDir}\AuteurFrame.ico
UninstallDisplayIcon={app}\AuteurFrame.exe
UninstallDisplayName=AuteurFrame
WizardStyle=modern
WizardImageFile={#AssetsDir}\wizard-side.bmp
WizardSmallImageFile={#AssetsDir}\wizard-small.bmp
OutputDir={#OutputDir}
OutputBaseFilename=AuteurFrame-Setup-{#AppVersion}
Compression=lzma2/ultra64
SolidCompression=yes
LZMAUseSeparateProcess=yes
LZMANumBlockThreads=4
AppMutex=Local\AuteurFrameDesktop
CloseApplications=yes
RestartApplications=no
ChangesAssociations=no
UsedUserAreasWarning=no
SetupLogging=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Shortcuts:"

[InstallDelete]
Type: filesandordirs; Name: "{app}\app"
Type: filesandordirs; Name: "{app}\runtime"

[Files]
Source: "{#StageDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#RedistDir}\MicrosoftEdgeWebview2Setup.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall; Check: NeedsWebView2

[Icons]
Name: "{group}\AuteurFrame"; Filename: "{app}\AuteurFrame.exe"; WorkingDir: "{app}"; IconFilename: "{app}\AuteurFrame.ico"; Comment: "Make motion films with an AI agent studio"
Name: "{group}\AuteurFrame logs"; Filename: "{localappdata}\AuteurFrame\logs"; Comment: "Open the AuteurFrame log folder"
Name: "{group}\Uninstall AuteurFrame"; Filename: "{uninstallexe}"
Name: "{autodesktop}\AuteurFrame"; Filename: "{app}\AuteurFrame.exe"; WorkingDir: "{app}"; IconFilename: "{app}\AuteurFrame.ico"; Tasks: desktopicon

[Run]
Filename: "{tmp}\MicrosoftEdgeWebview2Setup.exe"; Parameters: "/silent /install"; StatusMsg: "Installing the Microsoft Edge WebView2 runtime..."; Flags: waituntilterminated; Check: NeedsWebView2
Filename: "{app}\AuteurFrame.exe"; Description: "Launch AuteurFrame"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}\app"
Type: filesandordirs; Name: "{app}\runtime"

[Code]
function WebView2Version(): String;
var
  v: String;
begin
  Result := '';
  if RegQueryStringValue(HKLM, 'SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', v) and (v <> '') and (v <> '0.0.0.0') then begin Result := v; exit; end;
  if RegQueryStringValue(HKLM, 'SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', v) and (v <> '') and (v <> '0.0.0.0') then begin Result := v; exit; end;
  if RegQueryStringValue(HKCU, 'Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', v) and (v <> '') and (v <> '0.0.0.0') then begin Result := v; exit; end;
end;

function NeedsWebView2(): Boolean;
begin
  Result := WebView2Version() = '';
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  dataDir: String;
begin
  if CurUninstallStep = usPostUninstall then
  begin
    dataDir := ExpandConstant('{localappdata}\AuteurFrame');
    if DirExists(dataDir) then
    begin
      if UninstallSilent() then exit;
      if MsgBox('Do you also want to delete your AuteurFrame projects, settings and API keys?' + #13#10#13#10 +
                'They are stored in ' + dataDir + #13#10#13#10 +
                'Choose No to keep them for a future installation.', mbConfirmation, MB_YESNO or MB_DEFBUTTON2) = IDYES then
        DelTree(dataDir, True, True, True);
    end;
  end;
end;
