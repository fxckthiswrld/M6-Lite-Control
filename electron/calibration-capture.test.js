'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fixture=require('./calibration-capture-fixture.json');
const {decodeInputReport}=require('./hid-frame');
const {InitTransfer}=require('./he-protocol');
const {parseCalibration,visibleCalibrationRecords}=require('./calibration');
const layout=require('./keyboard-layout.json');
const expectedHash='9371a4c1c423ab66b16028312f4b8d9487daf3c17eada4e7c4e66d061547ee4a';

test('four historical device reads decode and reassemble to identical calibration',()=>{
 let transfer=new InitTransfer(24),cycles=0;
 for(const frame of fixture.reports){
   const decoded=decodeInputReport(Buffer.from(frame.report,'hex'));
   assert.equal(decoded.toString('hex'),frame.decoded,`Capture frame ${frame.frame}`);
   if(!transfer.accept(decoded))continue;
   const raw=transfer.finish();assert.equal(raw.length,420);
   assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),expectedHash);
   const keys=visibleCalibrationRecords(parseCalibration(raw),layout);
   assert.equal(keys.filter(k=>k.rangeStatus==='ok').length,64);
   const a=keys.find(k=>k.id==='2:1');assert.equal(a.min,1780);assert.equal(a.max,2613);
   cycles++;transfer=new InitTransfer(24);
 }
 assert.equal(cycles,4);assert.equal(transfer.parts.size,0);
});

test('historical transfer tolerates reordered duplicates but never a missing fragment',()=>{
 const packets=fixture.reports.slice(0,35).map(f=>decodeInputReport(Buffer.from(f.report,'hex')));
 const transfer=new InitTransfer(24);
 for(const p of packets.slice(1).reverse()){transfer.accept(p);transfer.accept(p);}
 assert.throws(()=>transfer.finish(),/Incomplete/);
 assert.equal(transfer.accept(packets[0]),true);
 assert.equal(crypto.createHash('sha256').update(transfer.finish()).digest('hex'),expectedHash);
 const corrupt=Buffer.from(packets[0]);corrupt[8]^=1;
 assert.throws(()=>transfer.accept(corrupt),/Conflicting/);
});
