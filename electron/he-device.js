'use strict';
const { encodeOutputReport, decodeInputReport } = require('./hid-frame');
const { InitTransfer, parseHeProfile, encodeHeWrite } = require('./he-protocol');

// One owner per transaction. Caller closes the handle; no simultaneous data listener.
class HeDevice {
  constructor(handle) { this.handle = handle; }
  send(payload) {
    const written = this.handle.write([...encodeOutputReport(payload)]);
    if (written !== 21) throw new Error(`Incomplete HID write: ${written}/21`);
  }
  readInit(kind, onPayload) {
    const request = Buffer.alloc(20); request.set([8,0,kind]);
    const transfer = new InitTransfer(kind);
    this.send(request);
    const deadline = Date.now()+3000;
    while (Date.now()<deadline) {
      const report = Buffer.from(this.handle.readTimeout(100));
      if (!report.length) continue;
      const payload = decodeInputReport(report);
      // Unsolicited reports share the same HID stream as INIT fragments. Let
      // callers inspect them before the INIT assembler filters them out.
      try { onPayload?.(payload); } catch { /* telemetry must never break a read */ }
      if (transfer.accept(payload)) return transfer.finish();
    }
    throw new Error(`Device read timed out (${transfer.parts.size}/${transfer.total ?? '?'} packets)`);
  }
  readProfile(layer) {
    if (layer !== 0 && layer !== 1) throw new RangeError('Verified profiles are M1 and M2');
    const raw = this.readInit(25+layer);
    return { raw, ...parseHeProfile(raw) };
  }
  readDeviceConfig() { return Buffer.from(this.readInit(1).subarray(0,14)); }
  writeDeviceConfig(config) {
    if(!Buffer.isBuffer(config)||config.length!==14)throw new Error('Expected full device configuration');
    const payload=Buffer.alloc(20);payload.set([8,2]);config.copy(payload,2);this.send(payload);
    // The device can still return the previous selection immediately after a
    // configuration write. Retry observations only; never resend the write.
    let error;
    for(let attempt=0;attempt<3;attempt++){
      try{if(this.readDeviceConfig().equals(config))return;error=new Error('Device profile switch did not verify');}
      catch(e){error=e;}
    }
    throw error;
  }
  withLayer(kind,layer,action) {
    if(!['programming','he'].includes(kind)||![0,1].includes(layer))throw new Error('Invalid profile selection');
    const original=this.readDeviceConfig(),desired=Buffer.from(original),offset=kind==='he'?11:2;
    if(original[offset]===layer)return action();
    desired[offset]=layer;
    try {this.writeDeviceConfig(desired);return action();}
    finally {this.writeDeviceConfig(original);}
  }
  writeKeyRaw(key, layer) { this.send(encodeHeWrite(key, layer)); }
}
module.exports = { HeDevice };
