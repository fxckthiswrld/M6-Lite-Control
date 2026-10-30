'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {readSingleLight,applySingleLight}=require('./lighting-single');
function setup(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'m6-single-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const sections=new Map([1,2,4,24,25,26,6,7,9,17].map(k=>[k,Buffer.alloc(k===7?840:k===6?228:24)]));for(let i=0;i<84;i++){sections.get(7)[i*10+1]=1;sections.get(7).fill(37,i*10+6,i*10+10);}const writes=[];const device={readInit(k){return Buffer.from(sections.get(k));},send(p){writes.push(p);if(p[1]===17)p.copy(sections.get(17),0,2,20);else{assert.deepEqual([...p.subarray(0,3)],[8,8,1]);p.copy(sections.get(7),(p[3]*6+p[4])*10,5,11);}}};return {root,sections,device,writes};}
test('Single Light RGB preserves each selected brightness and all unselected records',t=>{const {root,sections,device}=setup(t);sections.get(7)[82]=73;sections.get(7)[142]=128;const before=Buffer.from(sections.get(7));const result=applySingleLight(device,root,{keys:['2:1','2:2'],enabled:true,color:'#336699'});assert.equal(result.verified,true);for(const id of ['2:1','2:2'])assert.equal(result.keys.find(k=>k.id===id).color,'#336699');const expected=Buffer.from(before);for(const col of [1,2]){const o=(col*6+2)*10;expected[o]=1;expected.set([51,102,153],o+3);}assert.deepEqual(sections.get(7),expected);});
test('A failed group write restores already attempted keys',t=>{const {root,sections,device,writes}=setup(t),before=Buffer.from(sections.get(7)),send=device.send;device.send=p=>{send(p);if(writes.length===2)throw Error('Disconnected during group write');};assert.throws(()=>applySingleLight(device,root,{keys:['2:1','2:2'],enabled:true,color:'#112233'}),/original Single Light settings restored/);assert.deepEqual(sections.get(7),before);});
test('Single Light layer switch preserves all per-key records',t=>{const {root,sections,device}=setup(t),before=Buffer.from(sections.get(7));assert.equal(applySingleLight(device,root,{active:true}).enabled,true);assert.deepEqual(sections.get(7),before);assert.equal(applySingleLight(device,root,{active:false}).enabled,false);});
test('Unknown and duplicate keys, malformed colors and coerced flags cannot write',()=>{for(const request of [null,{keys:[],enabled:true,color:'#123456'},{keys:['bad'],enabled:true,color:'#123456'},{keys:['2:1','2:1'],enabled:true,color:'#123456'},{keys:['2:1'],enabled:1,color:'#123456'},{keys:['2:1'],enabled:true,color:'red'},{active:1}])assert.throws(()=>applySingleLight({},'',request));});
test('Unsupported saved modes are readable but cannot be overwritten',t=>{const {root,sections,device,writes}=setup(t);sections.get(7)[81]=2;assert.equal(readSingleLight(sections.get(7),sections.get(17)).keys.find(k=>k.id==='2:1').canEdit,false);assert.throws(()=>applySingleLight(device,root,{keys:['2:1'],enabled:true,color:'#123456'}),/Only Normal/);assert.equal(writes.length,0);});

test('Selected brightness supports zero, intermediate and maximum while preserving RGB and flags',t=>{
 const {root,sections,device}=setup(t);sections.get(7).set([1,1,57,12,34,56],80);sections.get(7).set([0,1,193,87,65,43],140);
 const expected=Buffer.from(sections.get(7));
 for(const brightness of [0,128,255]){
  const result=applySingleLight(device,root,{keys:['2:1','2:2'],brightness});expected[82]=brightness;expected[142]=brightness;
  assert.deepEqual(sections.get(7),expected);for(const id of ['2:1','2:2'])assert.equal(result.keys.find(k=>k.id===id).brightness,brightness);
 }
});
test('Color-only and enable-only requests preserve the other per-key settings',t=>{
 const {root,sections,device}=setup(t);sections.get(7).set([1,1,57,12,34,56],80);const expected=Buffer.from(sections.get(7));
 applySingleLight(device,root,{keys:['2:1'],color:'#112233'});expected.set([17,34,51],83);assert.deepEqual(sections.get(7),expected);
 applySingleLight(device,root,{keys:['2:1'],enabled:false});expected[80]=0;assert.deepEqual(sections.get(7),expected);
});
test('Assigning a color activates the key and enables the Single Light layer',t=>{
 const {root,sections,device}=setup(t),o=80;
 assert.equal(sections.get(7)[o],0);assert.equal(sections.get(17)[6],0);
 const result=applySingleLight(device,root,{keys:['2:1'],color:'#336699'});
 assert.equal(sections.get(7)[o],1);assert.equal(sections.get(17)[6],1);
 assert.equal(result.enabled,true);assert.equal(result.keys.find(k=>k.id==='2:1').enabled,true);
});
test('Explicit disable keeps a colored key off and the layer untouched',t=>{
 const {root,sections,device}=setup(t);
 applySingleLight(device,root,{keys:['2:1'],enabled:false,color:'#336699'});
 assert.equal(sections.get(7)[80],0);assert.equal(sections.get(17)[6],0);
});
test('Per-key records are wrapped in the light configuration so the overlay is redrawn',t=>{
 const {root,device,writes}=setup(t);
 applySingleLight(device,root,{keys:['2:1'],color:'#112233'});
 // Verified on hardware: the firmware paints the Single Light overlay only when a
 // light configuration packet follows the per-key SINGLE records.
 assert.deepEqual(writes.map(p=>p[1]),[17,8,17]);
});
test('Brightness-only edits leave activation and the layer untouched',t=>{
 const {root,sections,device}=setup(t);
 applySingleLight(device,root,{keys:['2:1'],brightness:128});
 assert.equal(sections.get(7)[80],0);assert.equal(sections.get(17)[6],0);
});
for(const fail of ['send','read'])test(`Brightness group ${fail} failure restores exact RGB, brightness and enable flags`,t=>{
 const {root,sections,device,writes}=setup(t);sections.get(7).set([1,1,57,12,34,56],80);sections.get(7).set([0,1,193,87,65,43],140);
 const before=Buffer.from(sections.get(7)),send=device.send,read=device.readInit;let failed=false;
 device.send=p=>{send(p);if(fail==='send'&&writes.length===2)throw Error('Partial group write');};
 device.readInit=k=>{if(fail==='read'&&writes.length&&!failed){failed=true;throw Error('Read disconnected');}return read(k);};
 assert.throws(()=>applySingleLight(device,root,{keys:['2:1','2:2'],brightness:128}),/original Single Light settings restored/);assert.deepEqual(sections.get(7),before);
});
test('Brightness rejects invalid values and effect requests before device access',()=>{
 for(const brightness of [-1,256,NaN,1.5,'128',null,undefined])assert.throws(()=>applySingleLight({},'',{keys:['2:1'],brightness}),/Brightness/);
 assert.throws(()=>applySingleLight({},'',{keys:['2:1']}),/Expected RGB/);
 assert.throws(()=>applySingleLight({},'',{keys:['2:1'],color:'#123456',mode:2}),/RGB and brightness editing only/);
});
test('Brightness restoration errors identify backup and never report success',t=>{
 const {root,device,writes}=setup(t),send=device.send;device.send=p=>{if(writes.length)throw Error('Disconnected');send(p);throw Error('Partial write');};
 assert.throws(()=>applySingleLight(device,root,{keys:['2:1'],brightness:128}),/restoration unverified: Disconnected\. Backup:/);
});
