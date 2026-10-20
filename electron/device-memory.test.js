'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {cacheCrc,saveDeviceMemory}=require('./device-memory');
const mask=Buffer.from('6a6d64663f2ef0430a41ea8f2bfce0e7d5527ba5','hex');
function report(a){const p=Buffer.alloc(20);p.set(a);return Buffer.from([4,...p.map((b,i)=>b^mask[i])]);}
function sections(){return new Map([[2,Buffer.alloc(4776)],[4,Buffer.alloc(4776)],[25,Buffer.alloc(984)],[26,Buffer.alloc(984)]]);}
function fixture(responses){
 let time=0,started=false;const sent=[];
 return {sent,options:{now:()=>time,timeoutMs:500},device:{
  send:p=>{sent.push(Buffer.from(p));started=true;},
  handle:{readTimeout:ms=>{time+=ms;return started?(responses.shift()||[]):[];}},
 }};
}
test('CRC matches vectors calculated with the table extracted from MMPanel',()=>{
 for(const [hex,value] of [['00000000',0xc704dd7b],['78563412',0xdf8a8a2b],['0102030405060708',0xa3141bda]])
  assert.equal(cacheCrc(Buffer.from(hex,'hex')),value);
});
test('save answers both HE cache requests before accepting SAVE_END',()=>{
 const f=fixture([report([0,0xc9]),report([0,0xca]),report([0,0xfe])]);
 const s=sections();s.get(25)[408]=99;
 const result=saveDeviceMemory(f.device,s,f.options);
 assert.deepEqual(f.sent.map(p=>[...p.subarray(0,3)]),[[8,0xf2,0],[8,0xc9,0],[8,0xca,0]]);
 assert.equal(f.sent[1].readUInt32LE(3),cacheCrc(s.get(25).subarray(0,980)));
 assert.equal(result.acknowledged,true);assert.equal(result.persistenceVerified,false);
});
test('successful HID write and CRC response are not a completed save',()=>{
 for(const responses of [[],[report([0,0xc9])],[report([8,0,25])]]){
  const f=fixture(responses);
  assert.throws(()=>saveDeviceMemory(f.device,sections(),f.options),/did not confirm SAVE_END/);
 }
});
test('queued and repeated CRC requests are answered without draining them',()=>{
 const f=fixture([report([0,0xc9]),report([0,0xc9]),report([0,0xfe])]);
 const read=f.device.handle.readTimeout;
 f.device.handle.readTimeout=ms=>{assert.ok(f.sent.length,'must not discard the request before sending DRIVER_ED');return read(ms);};
 assert.equal(saveDeviceMemory(f.device,sections(),f.options).acknowledged,true);
 assert.deepEqual(f.sent[1],f.sent[2]);
});
test('old SAVE_END cannot acknowledge an HE save without its CRC exchange',()=>{
 const f=fixture([report([0,0xfe])]);f.options.requireCrc=true;
 assert.throws(()=>saveDeviceMemory(f.device,sections(),f.options),/did not confirm SAVE_END/);
});
test('disconnect and malformed replies fail instead of reporting a save',()=>{
 const f=fixture([Buffer.from([4,0])]);
 assert.throws(()=>saveDeviceMemory(f.device,sections(),f.options),/21-byte/);
 f.device.send=()=>{throw Error('USB disconnected');};
 assert.throws(()=>saveDeviceMemory(f.device,sections(),f.options),/USB disconnected/);
});
test('CRC tags exclude the old host-cache tag and transfer padding',()=>{
 const a=fixture([report([0,0xc1]),report([0,0xc9]),report([0,0xfe])]);
 const b=fixture([report([0,0xc1]),report([0,0xc9]),report([0,0xfe])]);
 const left=sections(),right=sections();right.get(2).fill(255,4768);right.get(25).fill(255,980);
 saveDeviceMemory(a.device,left,a.options);saveDeviceMemory(b.device,right,b.options);
 assert.deepEqual(a.sent,b.sent);
});
