'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {decodeBackLightCandidate}=require('./lighting-readback');
const {decodeUnderLightCandidate}=require('./lighting-readback');
const {decodeLightConfigCandidate}=require('./lighting-readback');
test('configuration decoding keeps brightness and activation independent and does not interpret family-dependent bytes',()=>{
 const raw=Buffer.from(Array.from({length:24},(_,i)=>i));
 const result=decodeLightConfigCandidate(raw);
 assert.deepEqual(result.fields.sw_bright,{offset:3,raw:3});
 assert.deepEqual(result.fields.buttom_actived,{offset:5,raw:5});
 assert.deepEqual(result.fields.circle_bright,{offset:10,raw:10});
 assert.equal(result.familyDependentHex,'0c0d');
 assert.equal(result.tailHex,'121314151617');
 assert.equal(Object.values(result.fields).some(f=>[12,13].includes(f.offset)),false);
 assert.throws(()=>decodeLightConfigCandidate(Buffer.alloc(18)));
});
test('Under Light uses its own eight-byte records and preserves trailing bytes',()=>{
 const raw=Buffer.alloc(108);raw[0]=7;raw.set([1,255,0,128,0x34,0x12,0x78,0x56],50);raw[107]=0xaa;
 const result=decodeUnderLightCandidate(raw);
 assert.deepEqual(result.effects.normal,{offset:50,customRgbRaw:1,color:'#FF0080',speed1Raw:0x1234,speed2Raw:0x5678});
 assert.equal(result.effects.stream.color,'#000000');assert.equal(result.tailHex,'00aa');
 assert.throws(()=>decodeUnderLightCandidate(Buffer.alloc(106)));
});
test('candidate reads independent effect records and preserves unknown flags and tail',()=>{
 const raw=Buffer.alloc(228);raw[0]=5;raw[40]=7;raw.set([0x12,0x34,0x56],41);raw.writeUInt16LE(3000,44);raw[227]=0xff;
 const result=decodeBackLightCandidate(raw);
 assert.equal(result.effects.stream.color,'#123456');assert.equal(result.effects.normal.color,'#000000');
 assert.equal(result.effects.stream.speed1Raw,3000);assert.equal(result.effects.stream.customRgbRaw,7);
 assert.equal(result.tailHex,'000000000000000000ff');assert.equal(result.verification,'static-layout-candidate');
 assert.throws(()=>decodeBackLightCandidate(raw.subarray(0,227)));
});
