# Calibration readout investigation — 2026-10-17

The current adapter reads INIT24 (420 bytes) and returns `readAt` with
`liveProgressAvailable: false`. The renderer polls this path during an active
application calibration session. The separate decoder in
`electron/calibration-telemetry.js` is not connected to a device receive loop.
Neither polling nor its timestamp establishes live sensor measurements.

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

Conclusion: INIT24 polling did not expose intermediate ranges in this physical
trial. Updated works but is not calibration progress. No Finish was performed;
this trial does not measure when committed values change or rule out a separate
live channel. Next, capture intermediate device input reports, validate the
candidate telemetry format, and connect that stream to the UI. A synthetic
decoder test alone is insufficient evidence to call this implemented.
