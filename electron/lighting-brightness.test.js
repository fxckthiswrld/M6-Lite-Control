'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {applyBrightness}=require('./lighting-brightness');
const {applyUnderLightEnabled}=require('./lighting-brightness');
for(const fail of [false,true])test(`Under Light power preserves other settings and rolls back (failure=${fail})`,t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'m6-power-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const initial=Buffer.alloc(24,23);initial[9]=0;let current=Buffer.from(initial),writes=0;
 const device={readInit(k){return k===17?Buffer.from(current):Buffer.from([k]);},send(p){writes++;p.copy(current,0,2);if(fail&&writes===1)current[10]=0;}};
 if(fail){assert.throws(()=>applyUnderLightEnabled(device,root,true),/original configuration restored/);assert.deepEqual(current,initial);}
 else{assert.equal(applyUnderLightEnabled(device,root,true).enabled,true);const expected=Buffer.from(initial);expected[9]=1;assert.deepEqual(current,expected);applyUnderLightEnabled(device,root,false);assert.deepEqual(current,initial);}
});
test('Under Light power rejects coerced flags before accessing hardware',()=>{for(const value of [0,1,'true',null,undefined,{},NaN])assert.throws(()=>applyUnderLightEnabled({},'',value),/boolean/);});
for(const field of [3,10])for(const fail of [false,true])test(`brightness field ${field} verifies preservation and rollback (failure=${fail})`,t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'m6-bright-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const initial=Buffer.alloc(24,7);initial[field]=255;let current=Buffer.from(initial),writes=0;
 const d={readInit(kind){return kind===17?Buffer.from(current):Buffer.from([kind]);},send(p){writes++;assert.deepEqual([...p.subarray(0,2)],[8,17]);p.copy(current,0,2);if(fail&&writes===1)current[4]=99;}};
 if(fail){assert.throws(()=>applyBrightness(d,root,254,field),/original configuration restored/);assert.deepEqual(current,initial);assert.equal(writes,2);}
 else{const result=applyBrightness(d,root,254,field);assert.equal(result.verified,true);const expected=Buffer.from(initial);expected[field]=254;assert.deepEqual(current,expected);assert.equal(fs.readdirSync(result.backup).filter(n=>n.endsWith('.bin')).length,10);}
});
test('invalid brightness never reads or writes',()=>{for(const value of [-1,256,NaN,1.5,'100'])assert.throws(()=>applyBrightness({},'',value),/integer/);});
test('brightness tolerates volatile Back Light tail while retaining its evidence',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'m6-bright-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 let current=Buffer.alloc(24),tick=0;current[3]=255;
 const d={readInit(k){if(k===17)return Buffer.from(current);if(k===6){const b=Buffer.alloc(228);b.writeUInt32LE(++tick,224);return b;}return Buffer.from([k]);},send(p){p.copy(current,0,2);}};
 const result=applyBrightness(d,root,254);assert.equal(result.verified,true);assert.ok(fs.existsSync(path.join(result.backup,'backlight-tail.jsonl')));
});

const {applyUnderLightSync}=require('./lighting-brightness');
for(const fail of [false,true])test(`Normal Sync preserves other settings and rolls back (failure=${fail})`,t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'m6-sync-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const initial=Buffer.alloc(24,23);initial[11]=0;let current=Buffer.from(initial),writes=0;
 const device={readInit(k){return k===17?Buffer.from(current):Buffer.from([k]);},send(p){writes++;p.copy(current,0,2);if(fail&&writes===1)current[10]=0;}};
 if(fail){assert.throws(()=>applyUnderLightSync(device,root,true),/original configuration restored/);assert.deepEqual(current,initial);}
 else{assert.equal(applyUnderLightSync(device,root,true).sync,true);const expected=Buffer.from(initial);expected[11]=1;assert.deepEqual(current,expected);applyUnderLightSync(device,root,false);assert.deepEqual(current,initial);}
});
test('Normal Sync rejects coerced flags before hardware access',()=>{for(const value of [0,1,'true',null,undefined,{},NaN])assert.throws(()=>applyUnderLightSync({},'',value),/boolean/);});

const {applyBackLightEnabled}=require('./lighting-brightness');
for(const fail of [false,true])test(`Back Light enable preserves layers and rolls back (failure=${fail})`,t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'m6-back-power-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const initial=Buffer.alloc(24,23);initial[5]=1;let current=Buffer.from(initial),writes=0;
 const device={readInit(k){return k===17?Buffer.from(current):Buffer.from([k]);},send(p){writes++;p.copy(current,0,2);if(fail&&writes===1)current[6]=0;}};
 if(fail){assert.throws(()=>applyBackLightEnabled(device,root,false),/original configuration restored/);assert.deepEqual(current,initial);}
 else{assert.equal(applyBackLightEnabled(device,root,false).enabled,false);const expected=Buffer.from(initial);expected[5]=0;assert.deepEqual(current,expected);applyBackLightEnabled(device,root,true);assert.deepEqual(current,initial);}
});
test('Back Light enable rejects coerced flags before hardware access',()=>{for(const value of [0,1,'true',null,undefined,{},NaN])assert.throws(()=>applyBackLightEnabled({},'',value),/boolean/);});
