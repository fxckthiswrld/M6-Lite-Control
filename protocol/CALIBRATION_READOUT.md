# Calibration readout investigation — 2026-10-17

The adapter reads INIT24 (420 bytes) for the saved ranges and, during an active
calibration session, listens on a dedicated HID input stream as well as the
normal read path. Payloads are accepted only when byte 1 is `0x30` and their
three five-byte entries pass the physical-key/index checks. Accepted entries
are accumulated by physical key and returned separately as `live`; they never
overwrite the saved INIT24 records. The UI exposes input-frame and rejected
frame counters to distinguish an absent telemetry stream from a decoder miss.

The receive format is still a static reconstruction: no captured hardware
frame has yet matched the candidate `0x30` payload. When no such frame arrives,
the renderer marks every key `Pending` and labels the shown numbers as stored.
It displays `OK · live` only for a validated live entry whose range is greater
than 500 counts. This keeps the UI useful without presenting INIT24 polling as
intermediate calibration.

The renderer now displays the successful read timestamp, successful-read count,
and number of physical min/max ranges changed since the previous successful
read. Poll errors are visible, slow polls cannot overlap, and replies arriving
after polling stops cannot overwrite the Finish/Cancel readback. The timestamp
is explicitly a read timestamp, not proof of calibration progress.

Verification:

- 42 calibration tests passed, including unchanged/changed values, read failure,
  overlapping polling and a stale reply after stopping polling.
- Full pre-push suite: **347/347 passed** (`node --test electron/*.test.js`).
- Windows build 0.10.62 rebuilt locally; no publication verification performed.
- `electron/smoke-calibration.cjs` exercised the source Electron UI and real USB
  reads. `electron-calibration-result.json` records reads at
  `2026-10-17T14:06:45.626Z` and `2026-10-17T14:06:45.812Z`.
  Updated and the read counter advanced; min/max changes were 0/64.
- Saved calibration and both HE profiles were unchanged. No calibration
  Start/Finish/Cancel/reset command was issued by this check.

Coordinated physical check, same day:

- `electron/observe-calibration.cjs` loaded the rebuilt packaged application
  from `dist`, opened Calibration and recorded its displayed values. The
  observer issued no calibration commands; the user clicked Calibrate all,
  physically pressed/held A, then clicked Cancel and confirmed completion.
- `calibration-live-observation.json` contains 11 successful polling reads from
  `14:09:07.264Z` through `14:09:17.200Z` during the active session. Updated and
  the successful-read counter advanced. Every physical range remained equal
  to the initial snapshot; A remained **1769 / 2612** throughout.
- Cancel readback at `14:09:19.768Z` reports `cancelVerified: true`, no changed
  records, and 64/64 unchanged physical keys. The session-start baseline is
  `calibration-command-696e4c3c-8f31-46cd-ac8d-b6c9ae8c5343.bin` under the app's
  `device-backups` directory, SHA-256
  `7f6092cc3a428baea8bc13e015fe562d319dc601a1584636a058bc929dfb5f1a`.

Conclusion: INIT24 polling did not expose intermediate ranges in the physical
trial. The candidate receive path is now connected behind strict validation and
the UI can display live values when matching frames are present. The existing
physical evidence still does not confirm that this device emits the candidate
frames, so a controlled capture remains required before claiming hardware
telemetry is working.
