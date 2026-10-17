# Original MMPanel settings evidence

Static review and focused runtime binding inspection, 2026-10-17. Scope: QC64
Highlight, Auto calibration, Auto light off, and Saturation. No device writes.

## Artifact identity and evidence limits

- Shipped `MMPanel.exe`, assembly 4.9.7.0, SHA-256
  `2537d9d620df12e51100c18ce9066d5dd38a01c38adf869d4d6925b78a9cd2fe`.
  REA identity evidence: `ev_1da861f04d56da95f8c51741cfd437e1243fcb49b4e4b3e8544e90ebdb1929c2`.
- Analysis-only `m6-cache-restored.analysis.exe`, SHA-256
  `5ad89b3efb2cba84b429a6eb66df1560d0bca6e9858835f34532c0c9f5c15d3f`.
  REA identity evidence: `ev_e79af05aa156a89804a3f9983076bb50ebe6ae530cc050b3d963feddf6f14abb`.
  This is reconstructed CIL from a previously captured runtime cache, **not a
  shipped executable**. `restore-runtime-cache.py` and `m6-cache-restoration.json`
  record reconstruction. Decompilation below uses this artifact.
- Both REA inventories report partial metadata coverage (duplicate Module /
  Assembly rows and invalid GUID/blob references). They establish identity,
  not complete semantic validation. Focused ILSpy decompilation succeeded for
  the listed properties; obfuscated control flow remains in the output.
- `runtime-settings-bindings.txt` and `runtime-settings-values.txt` are reused
  historical UI observations. Their dumper enumerates bindings, slider limits
  and visible labels. The follow-up `settings-binding-polarity.txt` records the
  exact source and converter in installed MMPanel PID 28156 at
  `2026-10-17T13:25:15.0654067Z`. Its assembly path is
  `C:\Program Files (x86)\MMPanel\MMPanel.exe`; its on-disk SHA-256 matches the
  shipped workspace artifact above exactly.

## Field mapping

Offsets are zero-based. Command offsets include the two-byte command header.
INIT offsets use the existing section mapping in this repository, corroborated
by the field order and navigation serializer. `INIT17` is shared lighting
configuration; `INIT6` is a different Back Light effect section.

| Control | Property owner and field | INIT offset | Command offset | UI range |
|---|---|---|---|---|
| Highlight | `NavigationViewModel.Highlight` -> `light_cfg.highlight` | INIT17[4] | `[8,17,...]` byte 6 | Toggle |
| Auto calibration | `NavigationViewModel.AutoCal` -> `dev_cfg.auto_cal` | INIT1[13] | `[8,2,...]` byte 15 | Toggle |
| Auto light off | `NavigationViewModel.FastSleep` -> `dev_cfg.fast_sleep` | INIT1[8] | `[8,2,...]` byte 10 | Toggle |
| Auto light off delay | `NavigationViewModel.FastSleepDelay` -> `dev_cfg.fast_sleep_delay` | INIT1[9] | `[8,2,...]` byte 11 | 1..30 minutes, step 1 |
| Saturation R | `SettingViewModel.BaoHe_R` -> `light_cfg.baohe_r` | INIT17[0] | `[8,17,...]` byte 2 | 64..255, step 1 |
| Saturation G | `SettingViewModel.BaoHe_G` -> `light_cfg.baohe_g` | INIT17[1] | `[8,17,...]` byte 3 | 64..255, step 1 |
| Saturation B | `SettingViewModel.BaoHe_B` -> `light_cfg.baohe_b` | INIT17[2] | `[8,17,...]` byte 4 | 64..255, step 1 |

All seven getters return the field byte directly. Setters assign the value
directly: no scaling, seconds conversion, offset, clamping, or HSV conversion.
In particular the UI's minute value is stored as the same byte, and Saturation
consists of three independent channel values rather than a single HSV saturation.
The sliders enforce the observed ranges; the byte setters do not enforce them.

Highlight, AutoCal, FastSleep and FastSleepDelay are not declared by
SettingViewModel. That class declares only the three BaoHe properties among
these controls. Runtime binding inspection confirms explicit NavigationViewModel
sources for the toggles and delay; BaoHe bindings use the SettingViewModel
DataContext, no explicit source. All seven bindings are TwoWay. Delay and all
three BaoHe sliders have no converter.

## Send path and preservation

`settings-get_*.cs`, `settings-set_*.cs` are focused decompilations.
Navigation setters compare the old value, assign on change, and increment
`newTaskID` even on an unchanged value. They do not issue calibration commands,
clear calibration data, reboot, or save persistent storage in these bodies.
BaoHe setters return early when unchanged; otherwise they assign one channel,
call the ViewModel notification helper, and increment NavigationViewModel's
`newTaskID`. The notification helper is identified by `m6-delegate-map.txt`.

`device-navigation-thread.cs` (`QC64.NavigationViewModel.PageThread_Proc`)
queues both DEV and LIGHT_CFG packets when its task guard and connection guard
permit sending. Thus the original sender serializes complete shared state,
even for a single setting change. It increments the navigation queue pointer
after each packet and wraps that pointer modulo 8. This review does not infer
firmware behavior from the names of fields.

DEV byte positions 2..15 are, in order:
`dev_mode, trans_mode, key_layer, pfm_mode, cbk_actived, is_win_lock,
wireless_sleep, sleep_delay, fast_sleep, fast_sleep_delay, is_fn_alt_swap,
mag_cfg_layer, fps_enhance, auto_cal`.

LIGHT_CFG byte positions 2..19 correspond to:
`baohe_r, baohe_g, baohe_b, sw_bright, highlight, buttom_actived,
top_actived, enter_actived, enter_unify, circle_actived, circle_bright,
circle_sync, [not assigned by this sender], monitor_actived, mt_breath_speed,
mt_gradient_speed, me_argb_speed, me_spread_speed`.
The unassigned command byte 14 corresponds to `plate_sync_actived` in the QC64
structure. Preserve it and all unrelated bytes; do not replace it with zero.
INIT17 has 24 observed bytes; bytes 18..23 are outside this 18-byte named
structure and must also be preserved. Field metadata is in `settings-metadata.txt`.

## UI semantics and remaining limits

The original labels state that Auto calibration is an aid and initial use
still needs manual setup; Auto light off switches lights off after inactivity
and labels its delay in minutes. Highlight carries the original text
"High precision usage, is not recommended to be enabled". No more specific
claim about its effect on magnetic scanning or luminous output follows from
the inspected getters/setters.

Runtime inspection closes the polarity question: `cbAutoCal`, `cbHighLight`,
and `cbFastSleep` all use `Helpers.ByteToBoolConverter`, with no parameter.
Direct calls to that converter return 0 -> false, 1 -> true, 2 -> true;
ConvertBack returns false -> 0 and true -> 1 for each binding. The inverse
`ByteToBool2Converter` is not used by these controls. Focused decompilations are
saved as `settings-ByteToBool*-*.cs`.

The runtime probe `settings-binding-polarity.cs` was compiled into a separate
helper DLL, loaded with the existing CLR invocation helper through Frida, and
instantiated an unattached QC64 SettingView on the WPF dispatcher. It inspected
binding metadata and called only the previously reviewed pure conversion
functions; it did not invoke setting setters, issue commands, attach the view
to a window, switch pages, or change USB state. The output SHA-256 is
`38e402f715cc67b0ee293c32399e5255eab6188d1505d43f78e9ec285e610924`.
The helper returned CLR HRESULT 0 and result 0. This is controlled runtime
evidence, separate from the REA static inventory IDs above.

Setters themselves accept arbitrary bytes and do not normalize unknown values.
A new client can restrict edits to canonical 0/1 and preserve unfamiliar bytes;
that stricter validation is a client design choice, not an original getter limit.

`SettingViewModel.PageThread_Proc` sends a separate G24 command, not these
lighting/device changes. `SliderUpDown_Execute` changes delay label visibility;
it does not convert or clamp delay bytes.

Not established here: firmware's physical effect, whether timers operate on
USB as well as wireless, precise idle reset events, auto-calibration algorithm,
or persistence over removal of power. These require separate firmware/runtime
evidence. No claims about those behaviors are needed to reproduce these controls.
