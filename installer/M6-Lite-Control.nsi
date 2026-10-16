!include "MUI2.nsh"

!ifndef APP_VERSION
  !define APP_VERSION "0.0.0"
!endif
!define APP_NAME "M6 Lite Control"
!define APP_EXE "M6 Lite Control.exe"
!define DIST_DIR "..\dist\M6-Lite-Control-${APP_VERSION}-win32-x64"

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
  DeleteRegKey HKCU "Software\M6 Lite Control"
  RMDir /r "$INSTDIR"
SectionEnd
