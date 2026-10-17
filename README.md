# M6 Lite Control

Windows Electron control software for the MMStudio M6 Lite+ Hall Effect keyboard.

The application provides an English Wootility-style interface for Hall Effect setup, keyboard programming, lighting and device settings. It communicates with the keyboard through its USB HID configuration interface.

## Included features

- Mechanical actuation and Rapid Trigger settings per switch.
- Multi-switch Hall Effect editing, Apply to all and profile export/import.
- Calibration readback, full-key calibration and selected-key calibration flow.
- Remap with a full-size keyboard target layout and icon/short-label picker.
- Media, FN/layer, HotKey, DKS and Snap Tap/SOCD programming.
- Back Light and Under Light controls; Single Light RGB and brightness for individual keys or groups.
- EQ lighting mode with tray operation.
- BeastMode, EyeMode, DevMode and FPS Enhance controls.
- Highlight, firmware Auto calibration, Auto light off (1–30 minutes) and Saturation R/G/B (64–255), each with an independent Apply action.
- Calibration read timestamps, range-change counts and polling errors. Live values before Finish are not yet available; see [the hardware check](protocol/CALIBRATION_READOUT.md).
- Keyboard tester and device memory save command.

## Build locally

Requirements: Windows x64, Node.js 22+, and npm.

```powershell
cd electron
npm ci
npm test
npm run build:win
```

The portable build is created in `dist/M6-Lite-Control-<version>-win32-x64`.

To create the installer, install NSIS and run:

```powershell
$version = node -p "require('./package.json').version"
& "$env:ProgramFiles(x86)\NSIS\makensis.exe" "/DAPP_VERSION=$version" "..\installer\M6-Lite-Control.nsi"
```

## Automated releases

The workflow in `.github/workflows/windows-release.yml` runs tests, builds the portable application, creates an NSIS installer and publishes a GitHub release when a `v*` tag is pushed.

```powershell
git tag v0.10.60
git push origin v0.10.60
```

The repository is intended to remain private because it contains device protocol and reverse-engineering implementation details.

## Device safety

Keep the keyboard connected directly over USB while applying settings. The application creates local backups before configuration writes. After changing a performance mode, wait for the keyboard to reconnect and use **Refresh** in Device Settings.
