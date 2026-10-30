!include "MUI2.nsh"

!ifndef APP_VERSION
  !define APP_VERSION "0.0.0"
!endif
!define APP_NAME "M6 Lite Control"
!define APP_PUBLISHER "M.M Studio"
!define APP_EXE "M6 Lite Control.exe"
!define UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\M6 Lite Control"
!define DIST_DIR "..\dist\M6-Lite-Control-${APP_VERSION}-win32-x64"

VIProductVersion "${APP_VERSION}.0"
VIAddVersionKey "ProductName" "${APP_NAME}"
VIAddVersionKey "CompanyName" "${APP_PUBLISHER}"
VIAddVersionKey "FileDescription" "${APP_NAME} Installer"
VIAddVersionKey "FileVersion" "${APP_VERSION}"
VIAddVersionKey "ProductVersion" "${APP_VERSION}"
VIAddVersionKey "LegalCopyright" "© ${APP_PUBLISHER}"

Name "${APP_NAME}"
OutFile "..\dist\M6-Lite-Control-${APP_VERSION}-Setup.exe"
InstallDir "$LOCALAPPDATA\Programs\M6 Lite Control"
InstallDirRegKey HKCU "Software\M6 Lite Control" "InstallDir"
RequestExecutionLevel user
Unicode True
SetCompressor /SOLID lzma

!define MUI_ABORTWARNING
!define MUI_ICON "..\electron\logo256.ico"
!define MUI_UNICON "..\electron\logo256.ico"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
; Offer to start the application right after a successful install.
!define MUI_FINISHPAGE_RUN
!define MUI_FINISHPAGE_RUN_FUNCTION "LaunchApp"
!define MUI_FINISHPAGE_RUN_TEXT "Run ${APP_NAME}"
!define MUI_FINISHPAGE_RUN_CHECKED
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

Section "Install"
  ; A running instance keeps the executable locked and would break an upgrade.
  DetailPrint "Closing ${APP_NAME} if it is running..."
  ExecWait 'taskkill /IM "${APP_EXE}" /F'
  Sleep 500
  SetOutPath "$INSTDIR"
  File /r "${DIST_DIR}\*"
  WriteRegStr HKCU "Software\M6 Lite Control" "InstallDir" "$INSTDIR"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayName" "${APP_NAME}"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKCU "${UNINST_KEY}" "Publisher" "${APP_PUBLISHER}"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayIcon" "$INSTDIR\${APP_EXE},0"
  WriteRegStr HKCU "${UNINST_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINST_KEY}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr HKCU "${UNINST_KEY}" "QuietUninstallString" '"$INSTDIR\Uninstall.exe" /S'
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoRepair" 1
  ; The executable carries the application icon, so the shortcuts inherit it
  ; without depending on an extra .ico file inside the install directory.
  CreateShortCut "$DESKTOP\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}"
  CreateDirectory "$SMPROGRAMS\${APP_NAME}"
  CreateShortCut "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}"
  CreateShortCut "$SMPROGRAMS\${APP_NAME}\Uninstall.lnk" "$INSTDIR\Uninstall.exe"
SectionEnd

Function LaunchApp
  Exec '"$INSTDIR\${APP_EXE}"'
FunctionEnd

Section "Uninstall"
  ExecWait 'taskkill /IM "${APP_EXE}" /F'
  Sleep 500
  Delete "$DESKTOP\${APP_NAME}.lnk"
  Delete "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk"
  Delete "$SMPROGRAMS\${APP_NAME}\Uninstall.lnk"
  RMDir "$SMPROGRAMS\${APP_NAME}"
  DeleteRegKey HKCU "${UNINST_KEY}"
  DeleteRegKey HKCU "Software\M6 Lite Control"
  RMDir /r "$INSTDIR"
SectionEnd
