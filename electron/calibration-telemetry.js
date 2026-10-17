'use strict';

// Legacy 56-byte IOCTL input buffer; not verified as incoming device telemetry.
// The transport/report header is retained because the physical-key mapping
// is supplied by the vendor's PHY_KEY_LIST, not by this frame alone.
function parseCalibrationTelemetry(frame) {
  if (!Buffer.isBuffer(frame) || frame.length !== 56) throw new Error('Expected 56-byte calibration telemetry frame');
  if (frame[0] !== 0x38 || frame[8] !== 0x04) return null;
  return {
    report: frame[0], type: frame[8],
    sample: frame.readUInt16LE(12),
    metadata: Buffer.from(frame.subarray(14, 17)),
    channel: frame[16],
    raw: Buffer.from(frame)
  };
}
module.exports={parseCalibrationTelemetry};

// QC64 NavigationViewModel.HidRcvProc, restored IL:
// 0x17e2: index at payload[5 + slot*5], 0xff means unused;
// 0x2219: CalMin[index] = LE16(payload[6 + slot*5]);
// 0x2dc4: CalMax[index] = LE16(payload[8 + slot*5]);
// 0x9235: three slots. The envelope/dispatch discriminator is not yet verified.
// Accept only the extracted 15-byte body; never classify arbitrary HID packets.
function decodeCalibrationEntries(body, physicalKeys) {
  if(!Buffer.isBuffer(body)||body.length!==15)throw new Error('Expected 15-byte calibration entry body');
  if(!Array.isArray(physicalKeys)||physicalKeys.length!==64)throw new Error('Expected vendor physical key order');
  const entries=[];
  for(let offset=0;offset<15;offset+=5){
    const index=body[offset];
    if(index===255)continue;
    if(index>=64)throw new Error(`Invalid calibration key index ${index}`);
    const key=physicalKeys[index];
    const min=body.readUInt16LE(offset+1),max=body.readUInt16LE(offset+3);
    entries.push({index,id:key.id,row:key.row,col:key.col,min,max,
      rangeReady:max-min>500});
  }
  return entries;
}
module.exports.decodeCalibrationEntries=decodeCalibrationEntries;

// Static receive-path evidence: IL 0x790e reads data[1], 0x5f74
// copies it to the dispatch local, and 0x8d0c compares it with 48.
// This accepts already-decoded protocol payloads, never USBPcap/IOCTL buffers.
function decodeCalibrationPayload(payload, physicalKeys) {
  if(!Buffer.isBuffer(payload)||payload.length!==20)throw new Error('Expected decoded 20-byte payload');
  // Receive dispatch checks byte 1. Do not assume responses echo output byte 0.
  if(payload[1]!==0x30)return null;
  return {entries:decodeCalibrationEntries(payload.subarray(5),physicalKeys),
    header:Buffer.from(payload.subarray(0,5))};
}
module.exports.decodeCalibrationPayload=decodeCalibrationPayload;

// Merge only entries received during the current calibration session. Missing
// keys are deliberately left out: their stored INIT24 values must not be
// mistaken for a measurement from this session.
function mergeCalibrationEntries(target, entries) {
  if (!(target instanceof Map)) throw new TypeError('Expected a calibration entry map');
  if (!Array.isArray(entries)) throw new TypeError('Expected calibration entries');
  for (const entry of entries) {
    if (!entry || typeof entry.id !== 'string' || !Number.isInteger(entry.min) || !Number.isInteger(entry.max)) continue;
    target.set(entry.id, { ...entry, rangeStatus: entry.max - entry.min > 500 ? 'ok' : 'not-calibrated' });
  }
  return target;
}
module.exports.mergeCalibrationEntries=mergeCalibrationEntries;
