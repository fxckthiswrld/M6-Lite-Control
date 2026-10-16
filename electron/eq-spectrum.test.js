'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {encodeEqSpectrum}=require('./eq-spectrum'),{encodeOutputReport}=require('./hid-frame');
test('Recovered 14-band spectrum command preserves band order and clears unused bytes',()=>{
 const levels=[0,1,2,3,4,5,6,7,8,9,10,11,127,255],packet=encodeEqSpectrum(levels);
 assert.deepEqual([...packet],[8,38,...levels,0,0,0,0]);assert.equal(encodeOutputReport(packet).length,21);
 levels[0]=123;assert.equal(packet[2],0);
});
test('Invalid FFT values cannot silently wrap or coerce into spectrum bytes',()=>{
 for(const levels of [null,{},'12345678901234',[],Array(13).fill(0),Array(15).fill(0),Array(14),...[-1,256,NaN,Infinity,0.5,'2'].map(x=>[x,...Array(13).fill(0)])])assert.throws(()=>encodeEqSpectrum(levels));
});
test('Silence produces a zero spectrum and typed byte levels are accepted',()=>{
 assert.deepEqual(encodeEqSpectrum(new Uint8Array(14)),Buffer.from([8,38,...Array(18).fill(0)]));
});
