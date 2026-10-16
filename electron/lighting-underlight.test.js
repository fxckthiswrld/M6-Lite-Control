'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {readUnderLight,encodeUnderLightMode,applyUnderLightMode}=require('./lighting-underlight');
function setup(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'m6-under-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const sections=new Map([1,2,4,24,25,26,6,7,9,17].map(k=>[k,Buffer.alloc(k===6?228:k===9?108:24,k)]));sections.get(9)[0]=5;sections.get(17)[11]=0;
 const writes=[];let tick=0;
 const d={readInit(k){const raw=Buffer.from(sections.get(k));if(k===6)raw.writeUInt32LE(++tick,224);return raw;},send(p){writes.push(Buffer.from(p));assert.equal(p[1],11);sections.get(9)[0]=p[3];}};
 return {root,sections,d,writes};
}
test('All Under Light modes preserve Back Light and other sections',t=>{
 const {root,sections,d}=setup(t),original=new Map([...sections].map(([k,b])=>[k,Buffer.from(b)]));
 for(const mode of [3,4,5,6,7]){const result=applyUnderLightMode(d,root,mode);assert.equal(result.verified,true);assert.equal(result.mode,mode);for(const [k,b] of sections){const expected=Buffer.from(original.get(k));if(k===9)expected[0]=mode;assert.deepEqual(b,expected);}}
 applyUnderLightMode(d,root,5);assert.deepEqual(sections,original);
});
test('Under Light uses distinct mode byte and reuses saved parameters',()=>{
 const raw=Buffer.alloc(108);raw.set([1,17,34,51,0x34,0x12,0x78,0x56],2);raw.set([1,17,34,51,0,0,0,0],50);raw.writeUInt16LE(3000,22);
 assert.deepEqual([...encodeUnderLightMode(raw,7).subarray(0,12)],[8,11,0,7,0,0,0,0,1,17,34,51]);
 assert.deepEqual([...encodeUnderLightMode(raw,3).subarray(0,12)],[8,11,0,3,0x34,0x12,0,0,1,17,34,51]);
 assert.deepEqual([...encodeUnderLightMode(raw,5).subarray(0,12)],[8,11,0,5,0xb8,0x0b,0,0,0,0,0,0]);
});
test('Under Light readback mismatch restores original mode',t=>{
 const {root,d,sections,writes}=setup(t),send=d.send;d.send=p=>{send(p);if(writes.length===1)sections.get(9)[0]=99;};
 assert.throws(()=>applyUnderLightMode(d,root,7),/original Under Light mode restored/);assert.equal(sections.get(9)[0],5);assert.equal(writes.length,2);
});
test('Collateral Back Light changes are not reported as restored',t=>{
 const {root,d,sections}=setup(t),send=d.send;d.send=p=>{send(p);sections.get(6)[3]=77;};
 assert.throws(()=>applyUnderLightMode(d,root,7),/restoration unverified/);
});
test('Unsupported mode and malformed sections never lead to writes',t=>{
 for(const mode of [0,1,2,8,'5',null])assert.throws(()=>applyUnderLightMode({},'',mode),/Unsupported/);
 assert.throws(()=>readUnderLight(Buffer.alloc(106)),/108-byte/);
 const {root,d,sections,writes}=setup(t);sections.get(9)[0]=1;assert.throws(()=>applyUnderLightMode(d,root,7),/cannot yet be restored/);assert.equal(writes.length,0);
});
test('Normal and Breath color preserve other records and Back Light',t=>{
 const {root,sections,d}=setup(t),send=d.send;
 for(const [mode,offset] of [[7,50],[3,2]]){
  const raw=sections.get(9);raw[0]=mode;raw[offset]=0;const original=Buffer.from(raw);
  d.send=p=>{send(p);raw[offset]=p[8];p.copy(raw,offset+1,9,12);};
  const result=applyUnderLightMode(d,root,mode,{customRgb:mode===3,color:'#336699'});
  assert.equal(result.customRgb,mode===3);assert.equal(result.color,'#336699');
  const expected=Buffer.from(original);expected.set([mode===3?1:0,0x33,0x66,0x99],offset);assert.deepEqual(raw,expected);
  applyUnderLightMode(d,root,mode,readUnderLight(original));assert.deepEqual(raw,original);
 }
});
test('Failed Under Light color verification restores RGB and flag',t=>{
 const {root,sections,d,writes}=setup(t),raw=sections.get(9),send=d.send;raw[0]=7;raw[50]=0;const original=Buffer.from(raw);
 d.send=p=>{send(p);raw[50]=p[8];p.copy(raw,51,9,12);if(writes.length===1)raw[51]=0;};
 assert.throws(()=>applyUnderLightMode(d,root,7,{customRgb:false,color:'#336699'}),/original Under Light mode restored/);assert.deepEqual(raw,original);
});
test('Unsupported, malformed and stale Under Light color edits cannot write',t=>{
 assert.throws(()=>applyUnderLightMode({},'',7,{customRgb:true,color:'#112233'}),/direct color without Custom RGB/);
 for(const mode of [4,5,6])assert.throws(()=>applyUnderLightMode({},'',mode,{customRgb:true,color:'#112233'}),/Normal and Breath only/);
 for(const options of [null,{}, {customRgb:1,color:'#112233'},{customRgb:true,color:'red'}])assert.throws(()=>applyUnderLightMode({},'',7,options),/Expected/);
 const {root,d,writes}=setup(t);assert.throws(()=>applyUnderLightMode(d,root,7,{customRgb:false,color:'#112233'}),/Active Under Light effect changed/);assert.equal(writes.length,0);
});
test('Four Under Light speeds preserve colors, other effects and Back Light',t=>{
 const {root,d,sections}=setup(t),raw=sections.get(9),send=d.send;
 for(const [mode,offset,min,max] of [[3,6,1500,3000],[4,14,5000,20000],[5,22,2000,6000],[6,30,2000,4000]]){
  raw[0]=mode;const original=Buffer.from(raw);d.send=p=>{send(p);p.copy(raw,offset,4,6);};
  for(const speed of [min,max]){const result=applyUnderLightMode(d,root,mode,undefined,{speed});assert.equal(result.speed,speed);assert.equal(result.speedMinimum,min);assert.equal(result.speedMaximum,max);const expected=Buffer.from(original);expected.writeUInt16LE(speed,offset);assert.deepEqual(raw,expected);}
  for(const speed of [min-1,max+1,'2000',NaN,Infinity,2000.5])assert.throws(()=>applyUnderLightMode({},'',mode,undefined,{speed}),/integer/);
 }
});
test('Speed mismatch restores timing; stale effect and Normal speed edits are rejected',t=>{
 const {root,d,sections,writes}=setup(t),raw=sections.get(9),send=d.send;raw.writeUInt16LE(3000,22);const original=Buffer.from(raw);
 d.send=p=>{send(p);p.copy(raw,22,4,6);if(writes.length===1)raw[22]=0;};
 assert.throws(()=>applyUnderLightMode(d,root,5,undefined,{speed:3100}),/original Under Light mode restored/);assert.deepEqual(raw,original);
 const count=writes.length;assert.throws(()=>applyUnderLightMode(d,root,3,undefined,{speed:2100}),/Active Under Light effect changed/);assert.equal(writes.length,count);
 assert.throws(()=>applyUnderLightMode({},'',7,undefined,{speed:3000}),/no speed control/);
});

test('Normal Sync blocks effect, color and speed writes',t=>{
 const {root,d,sections,writes}=setup(t);sections.get(17)[11]=1;
 for(const args of [[5],[3,{customRgb:true,color:'#123456'}],[5,undefined,{speed:3000}]])assert.throws(()=>applyUnderLightMode(d,root,...args),/Disable Normal Sync/);
 assert.equal(writes.length,0);
});
