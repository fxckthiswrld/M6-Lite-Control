'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {encodeNormalCandidate}=require('./lighting-command');
const {encodeStreamCandidate,BACK_LIGHT_MODE}=require('./lighting-command');
test('Stream uses recovered mode and little-endian speed without changing speed2 or trailing bytes',()=>{
 const original=Buffer.alloc(20,0xa5);
 const out=encodeStreamCandidate(original,{direction:true,speed:0x1234,customRgb:false,color:'#00ff80'});
 assert.equal(BACK_LIGHT_MODE.normal,2);
 assert.deepEqual([...out.subarray(0,12)],[8,5,5,1,0x34,0x12,0xa5,0xa5,0,0,255,128]);
 assert.deepEqual(out.subarray(12),original.subarray(12));
 assert.deepEqual(original,Buffer.alloc(20,0xa5));
 for(const speed of [-1,65536,1.5,NaN])assert.throws(()=>encodeStreamCandidate(original,{direction:true,speed,customRgb:false,color:'#000000'}));
});
test('Normal candidate preserves untouched original payload bytes and RGB channel order',()=>{
 const template=Buffer.from(Array.from({length:20},(_,i)=>i+30)),before=Buffer.from(template);
 const out=encodeNormalCandidate(template,{mode:7,customRgb:true,color:'#12abEF'});
 assert.deepEqual([...out.subarray(0,3)],[8,5,7]);
 assert.deepEqual([...out.subarray(8,12)],[1,0x12,0xab,0xef]);
 for(const i of [3,4,5,6,7,12,13,14,15,16,17,18,19])assert.equal(out[i],template[i]);
 assert.deepEqual(template,before);
});
test('Normal candidate rejects invalid values before encoding',()=>{
 const p={mode:1,customRgb:false,color:'#000000'},b=Buffer.alloc(20);
 assert.throws(()=>encodeNormalCandidate(Buffer.alloc(19),p));
 for(const mode of [-1,256,1.5,NaN])assert.throws(()=>encodeNormalCandidate(b,{...p,mode}));
 assert.throws(()=>encodeNormalCandidate(b,{...p,customRgb:'false'}));
 assert.throws(()=>encodeNormalCandidate(b,{...p,color:'#fff'}));
});
