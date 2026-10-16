'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {parseCalibrationTelemetry}=require('./calibration-telemetry');
test('parses observed 0x04 calibration telemetry fields',()=>{
 const frame=Buffer.from('380000000000000004000000f035741cb2000000c84fc3784a10ca4a9ea4524d52996e570001000000000000000000000000000014000000','hex');
 const parsed=parseCalibrationTelemetry(frame);assert.equal(parsed.sample,0x35f0);assert.equal(parsed.channel,0xb2);assert.deepEqual([...parsed.metadata],[0x74,0x1c,0xb2]);
});
test('rejects unverified telemetry shapes',()=>{assert.throws(()=>parseCalibrationTelemetry(Buffer.alloc(55)),/56-byte/);const f=Buffer.alloc(56);assert.equal(parseCalibrationTelemetry(f),null);});

const {decodeCalibrationEntries}=require('./calibration-telemetry');
const order=require('./calibration-key-order.json');
test('vendor physical order maps A and matrix gaps without shifting later keys',()=>{
 const body=Buffer.alloc(15);
 for(const [slot,index] of [29,40,63].entries()){
   body[slot*5]=index;body.writeUInt16LE(1700,slot*5+1);body.writeUInt16LE(2600,slot*5+3);
 }
 const entries=decodeCalibrationEntries(body,order);
 assert.deepEqual(entries.map(e=>e.id),['2:1','2:13','4:13']);
 assert.ok(entries.every(e=>e.min===1700&&e.max===2600&&e.rangeReady));
 const visible=require('./keyboard-layout.json');
 assert.deepEqual(new Set(order.map(k=>k.id)),new Set(visible.map(k=>k.id)));
});
test('unused slots are ignored; invalid slot rejects the whole body',()=>{
 const body=Buffer.alloc(15,255);
 assert.deepEqual(decodeCalibrationEntries(body,order),[]);
 body[0]=29;body.writeUInt16LE(2000,1);body.writeUInt16LE(2200,3);
 assert.equal(decodeCalibrationEntries(body,order)[0].rangeReady,false);
 body[10]=64;assert.throws(()=>decodeCalibrationEntries(body,order),/key index/);
 assert.throws(()=>decodeCalibrationEntries(body.subarray(1),order),/15-byte/);
});
test('vendor progress range threshold is strictly greater than 500',()=>{
 const body=Buffer.alloc(15,255);body[0]=29;body.writeUInt16LE(1700,1);
 for(const [max,ready] of [[2200,false],[2201,true],[1600,false]]){
   body.writeUInt16LE(max,3);assert.equal(decodeCalibrationEntries(body,order)[0].rangeReady,ready);
 }
});

test('calibration dispatch accepts only decoded calibration payloads',()=>{
 const {decodeCalibrationPayload}=require('./calibration-telemetry');
 const payload=Buffer.alloc(20,255);payload.set([8,48,0,0,0]);
 payload[5]=29;payload.writeUInt16LE(1700,6);payload.writeUInt16LE(2600,8);
 const result=decodeCalibrationPayload(payload,order);
 assert.equal(result.entries.length,1);assert.equal(result.entries[0].id,'2:1');
 assert.equal(result.entries[0].min,1700);assert.equal(result.entries[0].max,2600);
 payload[0]=0;assert.equal(decodeCalibrationPayload(payload,order).entries[0].id,'2:1');
 for(const command of [0,49,51,191]){payload[1]=command;assert.equal(decodeCalibrationPayload(payload,order),null);}
 assert.throws(()=>decodeCalibrationPayload(Buffer.alloc(56),order),/20-byte/);
 assert.throws(()=>decodeCalibrationPayload(Buffer.alloc(21),order),/20-byte/);
});
