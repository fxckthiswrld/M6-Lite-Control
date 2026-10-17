# MMPanel settings parity

Scope (2026-10-17): Highlight, Auto calibration, Auto light off and Saturation.
Release publication verification is excluded at the user's request.

## Plan

1. **Done.** Establish the original QC64 UI bindings, ranges, getters/setters and command
   fields. Reuse the saved MMPanel runtime inventory and decompiled sender.
2. **Done.** Add validated, independent setting writes with backups, readback and
   preservation of the other configuration sections.
3. **Done.** Add Settings controls with explicit Apply actions. Refresh and navigation
   discard unapplied values.
4. **Done.** Test byte isolation, invalid requests, read/write failures and restoration;
   build and exercise the packaged UI and device readback where available.
5. **Done.** Record observed results separately from untested physical behavior and
   persistence after power removal.

## Original UI evidence

The saved `runtime-settings-bindings.txt` and `runtime-settings-values.txt`
identify these controls in MMPanel SettingView:

| Label | Binding | Control/range |
| --- | --- | --- |
| Highlight | Highlight | Toggle |
| Auto calibration | AutoCal | Toggle |
| Auto light off | FastSleep, FastSleepDelay | Toggle, 1–30 minutes |
| Saturation | BaoHe_R, BaoHe_G, BaoHe_B | Three sliders, 64–255 |

Auto calibration is a firmware option. The original UI says initial manual
calibration is still required. Auto light off is distinct from the separate
wireless Sleep option. The original Highlight help advises against enabling it
for high precision use; the physical effect needs hardware observation.

## Implementation

Version 0.10.62 adds four Settings cards with independent Apply actions.
Unapplied values are discarded on Refresh/navigation. Auto light off's delay
is editable when enabled; disabling preserves the stored delay. Saturation
uses three integer channel values, with no HSV conversion.

| Setting | Readback | Write payload |
| --- | --- | --- |
| Highlight | INIT17[4] | `[8,17]`, byte 6 |
| Auto calibration | INIT1[13] | `[8,2]`, byte 15 |
| Auto light off | INIT1[8] | `[8,2]`, byte 10 |
| Auto light off minutes | INIT1[9] | `[8,2]`, byte 11 |
| Saturation R/G/B | INIT17[0..2] | `[8,17]`, bytes 2..4 |

Each Apply backs up ten sections and patches only the requested fields in a
fresh device snapshot. It checks all ten sections after writing, reopening the
HID interface for retries if necessary. A failed check attempts restoration
of the changed configuration block and reports restoration failures explicitly.
Unknown values in other settings are preserved. Unknown toggle values block
editing that toggle. No persistent save command is sent automatically.

See [original evidence](SETTINGS_ORIGINAL_EVIDENCE.md) for artifact identity,
setter analysis, sender layout, UI ranges and limitations.

## Verification

- Automated tests: **345/345 passed** (`settings-parity-tests.log`). New tests
  cover all four commands, no-op behavior, field isolation, reconnects, write
  exceptions, rejected/ignored writes, restoration failures, unrelated
  calibration corruption and strict input validation.
- Windows build 0.10.62 passed (`settings-parity-build.log`).
- Packaged UI verification passed (`settings-parity-ui-verification.json`).
  Current values, enabled controls, draft-only edits and Refresh/navigation
  discard were checked; the Settings screenshot was visually reviewed.
- Packaged renderer -> IPC -> hardware verification passed
  (`settings-parity-hardware-verification.json`, `ok: true`, `restored: true`).
  Highlight and Auto calibration were each toggled on/off; Auto light off
  tested 1 and 30 minutes plus disabling while preserving the delay.
  Saturation tested [64,128,255], [255,64,128], [128,255,64]. Every step
  compared all ten backed-up sections, excluding only INIT6's unknown tail
  after its first 218 bytes. These checks verify stored fields, not actual
  idle timing or the auto-calibration algorithm.
- Original device and lighting configuration restored and all ten sections
  verified. Backup: `backups/settings-parity-68d8d070-a1a7-43aa-bb20-8396c3c88f3c`.
  No Save to device memory command was issued.
- Portable build:
  `dist/M6-Lite-Control-0.10.62-win32-x64/M6 Lite Control.exe`.

Not yet measured: physical Highlight/Saturation effects, the firmware's
auto-calibration algorithm, actual idle timing and persistence after removal
of power.
