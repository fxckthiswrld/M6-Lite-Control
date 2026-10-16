'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {readBackLight,encodeMode,applyBackLightMode}=require('./lighting-backlight');
function setup(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'m6-backlight-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const sections=new Map([1,2,4,24,25,26,6,7,9,17].map(k=>[k,Buffer.alloc(k===6?228:24,k)]));
 const raw=sections.get(6);raw[0]=5;raw.fill(0,8,18);raw[10]=1;raw[11]=255;raw.fill(0,38,48);raw[42]=255;raw.writeUInt16LE(3000,44);
 let tick=0;const writes=[];
 const d={readInit(k){const b=Buffer.from(sections.get(k));if(k===6)b.writeUInt32LE(++tick,224);return b;},send(p){writes.push(Buffer.from(p));sections.get(6)[0]=p[2];}};
 return {root,sections,d,writes};
}
test('Normal / Stream switch preserves settings despite changing unknown tail',t=>{
 const {root,sections,d,writes}=setup(t);const original=Buffer.from(sections.get(6));
 assert.equal(applyBackLightMode(d,root,2).mode,2);assert.equal(applyBackLightMode(d,root,5).mode,5);
 assert.deepEqual(sections.get(6),original);assert.deepEqual([...writes[0].subarray(0,12)],[8,5,2,0,0,0,0,0,1,255,0,0]);
 assert.equal(writes[1].readUInt16LE(4),3000);
});
test('Custom color writes preserve unrelated configuration and can be restored',t=>{
 const {root,d,sections}=setup(t),send=d.send,original=Buffer.from(sections.get(6));
 d.send=p=>{send(p);const raw=sections.get(6),offset=8+(p[2]-2)*10;raw[offset+2]=p[8];p.copy(raw,offset+3,9,12);};
 const result=applyBackLightMode(d,root,5,{customRgb:true,color:'#336699'});
 assert.equal(result.color,'#336699');assert.equal(result.customRgb,true);
 const expected=Buffer.from(original);expected.set([1,0x33,0x66,0x99],40);assert.deepEqual(sections.get(6),expected);
 const before=readBackLight(original);applyBackLightMode(d,root,5,before);assert.deepEqual(sections.get(6),original);
});
test('Color rollback restores the previous color, flag and effect',t=>{
 const {root,d,sections,writes}=setup(t),send=d.send,original=Buffer.from(sections.get(6));
 d.send=p=>{send(p);const raw=sections.get(6);raw[40]=p[8];p.copy(raw,41,9,12);if(writes.length===1)raw[41]=0;};
 assert.throws(()=>applyBackLightMode(d,root,5,{customRgb:true,color:'#336699'}),/original mode restored/);
 assert.deepEqual(sections.get(6),original);
});
test('Stale effect selection cannot overwrite a different active effect',t=>{
 const {root,d,writes}=setup(t);assert.throws(()=>applyBackLightMode(d,root,2,{customRgb:true,color:'#112233'}),/Active effect changed/);assert.equal(writes.length,0);
});
test('Malformed colors and Gradient color requests never access hardware',()=>{
 for(const options of [null,{}, {customRgb:1,color:'#112233'},{customRgb:true,color:'red'},{customRgb:true,color:'#12345g'}])assert.throws(()=>applyBackLightMode({},'',5,options),/Expected/);
 assert.throws(()=>applyBackLightMode({},'',4,{customRgb:true,color:'#112233'}),/does not support/);
 assert.equal(readBackLight(Buffer.from([4,...Array(227).fill(0)])).canEditColor,false);
 assert.throws(()=>applyBackLightMode({},'',6,{customRgb:true,color:'#112233'}),/without a Custom RGB toggle/);
});
test('Star updates RGB without changing its unused custom-color field',t=>{
 const {root,d,sections}=setup(t),raw=sections.get(6),send=d.send;raw[0]=6;raw[50]=0;
 const before=Buffer.from(raw);d.send=p=>{send(p);p.copy(raw,51,9,12);};
 const state=applyBackLightMode(d,root,6,{customRgb:false,color:'#336699'});
 assert.equal(state.supportsCustomRgb,false);assert.equal(state.color,'#336699');
 const expected=Buffer.from(before);expected.set([0x33,0x66,0x99],51);assert.deepEqual(raw,expected);
});
test('Stream speed changes only its timing and rolls back on mismatch',t=>{
 const {root,d,sections,writes}=setup(t),send=d.send,raw=sections.get(6),original=Buffer.from(raw);
 d.send=p=>{send(p);p.copy(raw,44,4,6);};
 const result=applyBackLightMode(d,root,5,undefined,{speed:3100});assert.equal(result.speed,3100);
 const expected=Buffer.from(original);expected.writeUInt16LE(3100,44);assert.deepEqual(raw,expected);
 applyBackLightMode(d,root,5,undefined,{speed:3000});assert.deepEqual(raw,original);
 const count=writes.length;d.send=p=>{send(p);p.copy(raw,44,4,6);if(writes.length===count+1)raw[44]=0;};
 assert.throws(()=>applyBackLightMode(d,root,5,undefined,{speed:3100}),/original mode restored/);assert.deepEqual(raw,original);
});
test('Speed rejects unsupported modes, malformed input and stale mode',t=>{
 for(const speed of [1999,6001,NaN,Infinity,3000.5,'3000'])assert.throws(()=>applyBackLightMode({},'',5,undefined,{speed}),/integer/);
 assert.throws(()=>applyBackLightMode({},'',2,undefined,{speed:3000}),/no speed control/);
 const {root,d,sections,writes}=setup(t);sections.get(6)[0]=2;
 assert.throws(()=>applyBackLightMode(d,root,5,undefined,{speed:3100}),/Active effect changed/);assert.equal(writes.length,0);
});
test('All dynamic effects use their original speed range and isolated timing record',t=>{
 const {root,d,sections}=setup(t),raw=sections.get(6),send=d.send;
 d.send=p=>{send(p);p.copy(raw,14+(p[2]-2)*10,4,6);};
 for(const [mode,min,max] of [[3,1500,3000],[4,5000,20000],[5,2000,6000],[6,2000,5000],[7,3007,6000]]){
  raw[0]=mode;const before=Buffer.from(raw),offset=14+(mode-2)*10;
  for(const speed of [min,max]){const state=applyBackLightMode(d,root,mode,undefined,{speed});assert.equal(state.speed,speed);assert.equal(state.speedMinimum,min);assert.equal(state.speedMaximum,max);const expected=Buffer.from(before);expected.writeUInt16LE(speed,offset);assert.deepEqual(raw,expected);}
  for(const speed of [min-1,max+1])assert.throws(()=>applyBackLightMode({},'',mode,undefined,{speed}),/integer/);
 }
});
test('Stream reverse changes only direction and restores on mismatch',t=>{
 const {root,d,sections,writes}=setup(t),raw=sections.get(6),send=d.send,original=Buffer.from(raw);
 d.send=p=>{send(p);raw[38]=p[3];};
 assert.equal(applyBackLightMode(d,root,5,undefined,undefined,{reverse:true}).reverse,true);
 const expected=Buffer.from(original);expected[38]=1;assert.deepEqual(raw,expected);
 applyBackLightMode(d,root,5,undefined,undefined,{reverse:false});assert.deepEqual(raw,original);
 const count=writes.length;d.send=p=>{send(p);raw[38]=writes.length===count+1?2:p[3];};
 assert.throws(()=>applyBackLightMode(d,root,5,undefined,undefined,{reverse:true}),/original mode restored/);assert.deepEqual(raw,original);
});
test('Direction rejects unsupported modes, non-booleans and stale effect',t=>{
 assert.throws(()=>applyBackLightMode({},'',6,undefined,undefined,{reverse:true}),/Stream and Roll only/);
 for(const reverse of [0,1,'true',null])assert.throws(()=>applyBackLightMode({},'',5,undefined,undefined,{reverse}),/boolean/);
 const {root,d,sections,writes}=setup(t);sections.get(6)[0]=2;
 assert.throws(()=>applyBackLightMode(d,root,5,undefined,undefined,{reverse:true}),/Active effect changed/);assert.equal(writes.length,0);
});
test('Roll direction changes only its own record and preserves Stream direction',t=>{
 const {root,d,sections}=setup(t),raw=sections.get(6),send=d.send;raw[0]=7;raw[58]=0;
 const original=Buffer.from(raw);d.send=p=>{send(p);raw[58]=p[3];};
 assert.equal(applyBackLightMode(d,root,7,undefined,undefined,{reverse:true}).reverse,true);
 const expected=Buffer.from(original);expected[58]=1;assert.deepEqual(raw,expected);
 applyBackLightMode(d,root,7,undefined,undefined,{reverse:false});assert.deepEqual(raw,original);
});
test('Unexpected known-field change triggers rollback',t=>{
 const {root,d,sections,writes}=setup(t),send=d.send;
 d.send=p=>{send(p);sections.get(6)[1]=writes.length===1?99:6;};
 assert.throws(()=>applyBackLightMode(d,root,2),/original mode restored/);assert.equal(sections.get(6)[0],5);assert.equal(writes.length,2);
});
test('Unrestored collateral HE change is reported explicitly',t=>{
 const {root,d,sections}=setup(t),send=d.send;d.send=p=>{send(p);sections.get(25)[0]=99;};
 assert.throws(()=>applyBackLightMode(d,root,2),/restoration unverified/);
});
test('Unsupported starting modes cannot be written',t=>{
 const {root,d,sections,writes}=setup(t);sections.get(6)[0]=1;
 assert.equal(readBackLight(sections.get(6)).canSwitch,false);assert.throws(()=>applyBackLightMode(d,root,2),/cannot yet be safely restored/);assert.equal(writes.length,0);
});
test('Invalid destination modes and malformed readbacks are rejected',()=>{
 assert.throws(()=>applyBackLightMode({},'',1),/Unsupported Back Light mode/);
 assert.throws(()=>encodeMode(Buffer.alloc(12),2),/228-byte/);
});
test('Every supported effect can be selected and restored',t=>{
 const {root,d,sections}=setup(t);
 for(const mode of [2,3,4,5,6,7]){assert.equal(applyBackLightMode(d,root,mode).mode,mode);assert.equal(readBackLight(sections.get(6)).canSwitch,true);}
 assert.equal(applyBackLightMode(d,root,5).mode,5);
});
test('Star preserves both timing fields; Gradient only sends its timing',()=>{
 const raw=Buffer.alloc(228);raw.set([1,0,1,17,34,51,0x34,0x12,0x78,0x56],48);
 assert.deepEqual([...encodeMode(raw,6).subarray(0,12)],[8,5,6,0,0x34,0x12,0x78,0x56,1,17,34,51]);
 raw.set([1,0,1,17,34,51,0x34,0x12,0x78,0x56],28);
 assert.deepEqual([...encodeMode(raw,4).subarray(0,12)],[8,5,4,0,0x34,0x12,0,0,0,0,0,0]);
});
test('Breath preserves custom color and timing; Roll also preserves direction',()=>{
 const raw=Buffer.alloc(228),record=[1,0,1,17,34,51,0x34,0x12,0,0];raw.set(record,18);raw.set(record,58);
 assert.deepEqual([...encodeMode(raw,3).subarray(0,12)],[8,5,3,0,0x34,0x12,0,0,1,17,34,51]);
 assert.deepEqual([...encodeMode(raw,7).subarray(0,12)],[8,5,7,1,0x34,0x12,0,0,1,17,34,51]);
});
