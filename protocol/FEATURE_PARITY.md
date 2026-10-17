# Feature parity with original MMPanel

Updated 2026-10-17 for local build 0.10.62.

Percentages are engineering estimates of implemented user-visible behavior,
not measured percentages of source code or a guarantee of complete hardware
validation. 100% means no missing controls are known in the stated scope.
Physical verification gaps are listed separately. Partial estimates have no
exhaustive, weighted feature denominator. Do not average these overlapping rows
into a purportedly exact overall percentage.

The user confirmed this keyboard is wired-only. Compare the controls applicable
to that device, not every item instantiated by the shared QC64 SettingView.
Neither shared UI bindings nor assembly names establish hardware capability.
Radio/receiver features are outside this port's scope.
The user also confirmed that FN ALT Swap is absent from their Settings page;
exclude it regardless of its presence in the shared SettingView inventory.

| Area | Transfer | Available | Add or finish |
| --- | ---: | --- | --- |
| Mechanical / Rapid Trigger | 100% | Trigger/release, Head/Bottom, M1/M2, individual/group/all-key editing, readback, HE JSON | No known missing core controls; compare rare limit/validation cases with original |
| Snap Tap / SOCD and quick presets | 100% | Custom pairs, A/D and WASD presets, Off, M1/M2; physical M1 checks | Extend physical verification to M2 and additional key pairs |
| DKS | ~90% | Keyboard/mouse actions, interval, individual/all-key Apply, WASD preset | Finish original subfield audit; verify mouse actions, interval semantics and bulk behavior physically |
| Remap / Modify / Media / FN / HotKey | ~95% | Assignments, repeat edits, return to Standard, Off/Enable preserving assignments, per-key Reset | Broader key/default-reset coverage and Reset failure recovery; verify original bulk-reset behavior before exposing it |
| Manual calibration | ~90% | Start/Finish/Cancel, selected-key workflow, saved ranges, isolation reports, reconnect handling, session journal | Decode and expose live calibration telemetry; physically prove selected-key isolation and interrupted-session behavior |
| Back Light excluding EQ | ~95% | Normal, Breath, Gradient, Stream, Star, Roll; applicable RGB, speeds, reverse, brightness, power | Finish parameter-by-parameter comparison; verify physical effects and persistence |
| Under Light | 100% of known controls | Five original effects, applicable RGB/speeds, brightness, power, Normal Sync | Verify visible synchronization and persistence; no confirmed missing control |
| Single Light | 100% of requested/original scope | RGB and brightness for individual keys/groups, enable flags, exact raw brightness preservation | Verify visible layer priority and persistence; do not invent extra Single Light modes |
| EQ | ~75% | System loopback, FFT/bands, live output, tray lifecycle, app-restart resume | Initial device-already-in-EQ handling, audio/USB reconnect, remaining style/background UI parity, Windows-login checks; deferred by user |
| Settings | 6/6 confirmed groups, 100% control coverage | Performance modes, FPS Enhance, Highlight, Auto calibration, Auto light off, Saturation | No known missing controls in the confirmed scope; physical effects and persistence checks remain |
| Save to device memory | 100% command flow | Backup, SAVE_END, readback and previous power-cycle evidence for HE/programming/calibration | Power-cycle verification for newly added lighting/settings values |
| HE export/import | 100% HE scope | HE JSON for M1/M2 with validation | Full-device snapshot import/restore is separate, unfinished work; do not call raw backups a restore feature |
| Factory reset | Hardware shortcut covered | Fn+O instructions; physical shortcut previously observed | No verified software reset command; do not invent an original per-key calibration Reset |
| Firmware updater | 0%; model support needs confirmation | Historical references only | Establish the M6 Lite+ updater/bootloader protocol and firmware compatibility before implementation |
| UI and application lifecycle | ~90% estimate | English UI, keyboard map, Settings, tray, single instance, startup option, tester | Remaining original controls, accessibility/keyboard-navigation audit and broader Windows lifecycle checks |

## Settings denominator

The shared runtime `SettingView` inventory supplied eleven distinct groups,
but it was incorrect to count all eleven as requirements for this wired device.
Exclude 2.4G ID/Copy and AirRate. Also exclude the separate Sleep control
(bound to WirelessSleep) and TransMode until wired-model applicability is
established. The user also confirmed FN ALT Swap is absent from their Settings.
Six groups remain in the current scoped checklist, all six ported.
This 100% is conditional on that checklist, not a claim of an exhaustive device
capability audit. Performance's three choices count as one group; Saturation's
three channels count as one group. Dynamic Scan has no adjustable binding in
the inventory and is not counted. This is control coverage, not effort weighting.

| Original group | Transfer | Remaining |
| --- | ---: | --- |
| BeastMode / EyeMode / DevMode | 100% | Physical performance measurements and persistence |
| FPS Enhance | 100% | Physical scan-rate measurements and persistence |
| Highlight | 100% | Physical effect and persistence |
| Auto calibration | 100% toggle | Observe the firmware algorithm; initial manual calibration remains required |
| Auto light off | 100% | Observe actual idle timeout and wake behavior over USB, persistence |
| Saturation | 100% | Physical channel response and persistence |

2.4G ID/Copy and AirRate are not missing features of this wired keyboard.
WirelessSleep and TransMode remain excluded rather than listed as unfinished.
FN ALT Swap is absent from the user's Settings and is not planned.
Auto light off is a separate, explicitly requested feature and remains included.

Win lock, key filter and other shared-assembly names are not added to this
denominator without a confirmed applicable UI. Macro, knob, display and GIF
support likewise remain unconfirmed for this model. EQ gain controls and
automatic continuation of interrupted manual calibration are intentionally
excluded by user preference.

## Evidence and next work

- Current code: `electron/device-settings.js`, `renderer.js`, `he-adapter.js`,
  `lighting-*.js`, `eq-device-session.js`, `eq-host.js`, `ui-bridge.js`.
- Settings: [original evidence](SETTINGS_ORIGINAL_EVIDENCE.md) and
  [implementation/checks](SETTINGS_PARITY.md). Settings 0.10.62 passed 345 tests
  and packaged UI/device readback checks; original state was restored.
- Single: [RGB/brightness evidence](SINGLE_LIGHT_RGB_BRIGHTNESS.md).
- Prior Programming and calibration findings are retained in the workspace's
  `PROGRAMMING_PARITY_AUDIT.md`, `FEATURE_READINESS.md`, `WORK_PLAN_NEXT.md`.
- Suggested continuation: calibration telemetry/isolation and remaining
  Programming checks, plus physical/persistence verification of implemented
  settings. EQ stays deferred. No wireless or FN ALT Swap work planned.

No fresh hardware operations or tests were run for this status-only review.
