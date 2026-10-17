# Single Light RGB and brightness

Implemented in 0.10.61 for the MMStudio M6 Lite+ (QC64 protocol).

Single Light supports independent RGB and brightness edits for individual keys
or selected groups. The brightness slider displays 0–100%, mapped to the device's
0–255 byte. An untouched slider preserves the exact stored byte. RGB writes
preserve each selected key's brightness; brightness writes preserve each RGB
and override flag. Refresh and navigation discard unapplied edits.

## Encoding

INIT7 contains 840 bytes: 84 ten-byte records. A visible key's record starts at
`(column * 6 + row) * 10`. Normal records contain override enable at byte 0,
mode at byte 1, brightness at byte 2 and RGB at bytes 3–5. Bytes 6–9 are preserved.

The 20-byte SINGLE command starts with
`[8, 8, 1, column, row, active, mode, brightness, R, G, B]`.
QC64 `MixTopViewModel.CurLedA` reads/writes `normally.a` for selected keys;
`SendMTData` serializes it at command byte 7. Ordinary color editing preserves
this value. Setting it to 255 belongs to the original reset path, not RGB editing.
This per-key field is separate from shared `light_cfg.sw_bright`.

## Validation

- All 312 automated tests passed, including group isolation, input bounds,
  partial writes, read failures and restoration failure reporting.
- Packaged renderer/IPC/device tests on A/S verified different RGB values,
  brightness 0/128/255 and exact 73/255 retention during RGB Apply and an
  untouched brightness Apply.
- All ten backed-up device sections were restored. INIT6 comparison covers
  known configuration bytes 0–217; its unknown tail is retained but excluded.
- Packaged UI mouse navigation verified all 64 keys, the RGB swatch and
  brightness controls. Single Light has no effect selector.

`electron/verify-single-rgb-brightness.cjs` is a controlled hardware test that
temporarily changes A/S, saves raw backups and restores their original records
in `finally`. `electron/smoke-single-rgb.cjs` performs a read-only UI check.
Both accept `M6_SINGLE_APP` as the path to a packaged `resources/app` directory.

The tests establish stored configuration and UI behavior. Visible luminance and
retention after removal of USB power were not measured. No persistent Save
command was issued during these checks.
