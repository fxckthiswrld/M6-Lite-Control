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
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

Section "Install"
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
  CreateShortCut "$DESKTOP\M6 Lite Control.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\logo256.ico"
  CreateDirectory "$SMPROGRAMS\M6 Lite Control"
  CreateShortCut "$SMPROGRAMS\M6 Lite Control\M6 Lite Control.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\logo256.ico"
  CreateShortCut "$SMPROGRAMS\M6 Lite Control\Uninstall.lnk" "$INSTDIR\Uninstall.exe"
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\M6 Lite Control.lnk"
  Delete "$SMPROGRAMS\M6 Lite Control\M6 Lite Control.lnk"
  Delete "$SMPROGRAMS\M6 Lite Control\Uninstall.lnk"
  RMDir "$SMPROGRAMS\M6 Lite Control"
  DeleteRegKey HKCU "${UNINST_KEY}"
  DeleteRegKey HKCU "Software\M6 Lite Control"
  RMDir /r "$INSTDIR"
SectionEnd
