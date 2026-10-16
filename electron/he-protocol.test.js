'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {decodeInputReport}=require('./hid-frame');
const {InitTransfer,parseHeProfile}=require('./he-protocol');
const {millimetresToRaw}=require('./he-adapter');
const fixture=require('./test-fixtures/he-profile-capture.json');
const packets=fixture.reports.map(hex=>decodeInputReport(Buffer.from(hex,'hex')));
test('reconstructs a real device profile with out-of-order and duplicated packets',()=>{
  const transfer=new InitTransfer(25);
  transfer.accept(packets[0]);
  for(const packet of [...packets].reverse())transfer.accept(packet);
  const raw=transfer.finish();assert.equal(raw.length,984);
  const profile=parseHeProfile(raw);
  assert.equal(profile.keys.length,70);
  assert.deepEqual(profile.keys[29],{row:2,col:1,rtOn:0,reserved:0,head:160,trigger:100,release:100,fixedDown:500,fixedUp:500,bottom:100});
});
test('cannot accept an incomplete or conflicting device snapshot',()=>{
  const transfer=new InitTransfer(25);transfer.accept(packets[0]);
  assert.throws(()=>transfer.finish(),/Incomplete/);
  const conflicting=Buffer.from(packets[0]);conflicting[8]^=1;
  assert.throws(()=>transfer.accept(conflicting),/Conflicting/);
  assert.throws(()=>parseHeProfile(Buffer.alloc(980)),/Incomplete/);
});
test('ignores packets for another command and rejects malformed report IDs',()=>{
  assert.equal(new InitTransfer(26).accept(packets[0]),false);
  assert.throws(()=>decodeInputReport(Buffer.alloc(21)),/ID 4/);
  const unencoded=Buffer.alloc(21);unencoded[0]=4;unencoded[2]=0xbf;
  assert.deepEqual(decodeInputReport(unencoded),unencoded.subarray(1));
});
test('uses QC64 units without silently rounding user input',()=>{
  assert.equal(millimetresToRaw(0.42),210);
  assert.equal(millimetresToRaw(0.002),1);
  for(const bad of [NaN,Infinity,-1,3.4,0.001,'0.2'])assert.throws(()=>millimetresToRaw(bad));
});
test('vendor layout contains 64 unique physical switches with correct A/S/W coordinates',()=>{
  const layout=require('./keyboard-layout.json');
  assert.equal(layout.length,64);assert.equal(new Set(layout.map(k=>k.id)).size,64);
  for(const [label,id] of [['A','2:1'],['S','2:2'],['W','1:2']])assert.equal(layout.find(k=>k.label===label).id,id);
});
