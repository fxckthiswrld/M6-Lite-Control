'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {readSettings,applyAutoCalibration,applyAutoLightOff,applyHighlight,applySaturation}=require('./device-settings');
const kinds=[1,2,4,24,25,26,6,7,9,17];
function fixture(t,fault='none'){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'m6-settings-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const sections=Object.fromEntries(kinds.map(k=>[k,Buffer.alloc(k===6?228:24,k+16)]));
 sections[1][3]=2;sections[1][8]=0;sections[1][9]=7;sections[1][12]=1;sections[1][13]=0;
 sections[17].set([170,180,190]);sections[17][4]=0;
 const before=Object.fromEntries(kinds.map(k=>[k,Buffer.from(sections[k])]));let sends=0,unavailable=0;
 const adapter={transaction:fn=>{
  if(unavailable-->0)throw Error('Reconnecting');
  return fn({readInit:k=>{
   if(fault==='initial-read'&&sends===0&&k===7)throw Error('Initial read failed');
   const raw=Buffer.from(sections[k]);if(k===6)raw[227]=(raw[227]+sends)%256;return raw;
  },send:p=>{
   sends++;assert.equal(p.length,20);assert.equal(p[0],8);assert.ok([2,17].includes(p[1]));
   const target=p[1]===2?1:17;
   if(fault!=='ignored'||sends>1)p.copy(sections[target],0,2,target===1?16:20);
   if(fault==='neighbor'&&sends===1)sections[target][5]^=1;
   if(fault==='unrelated')sections[24][0]^=1;
   if(fault==='restore-failed')sections[target][5]^=1;
   if(fault==='reconnect'&&sends===1)unavailable=2;
   if(fault==='write-error'&&sends===1)throw Error('Detached after write');
  }});
 }};
 return {root,adapter,sections,before,sends:()=>sends};
}
const cases=[
 {name:'Highlight',apply:applyHighlight,value:true,kind:17,patch:{4:1}},
 {name:'Auto calibration',apply:applyAutoCalibration,value:true,kind:1,patch:{13:1}},
 {name:'Auto light off',apply:applyAutoLightOff,value:{enabled:true,minutes:30},kind:1,patch:{8:1,9:30}},
 {name:'Saturation',apply:applySaturation,value:[64,128,255],kind:17,patch:{0:64,1:128,2:255}}
];
for(const entry of cases)for(const fault of ['none','reconnect','write-error','ignored','neighbor','restore-failed','initial-read'])test(`${entry.name}: ${fault}`,async t=>{
 const f=fixture(t,fault),run=()=>entry.apply(f.adapter,f.root,entry.value,{wait:async()=>{}});
 if(['ignored','neighbor','restore-failed','initial-read'].includes(fault)){
  await assert.rejects(run(),fault==='restore-failed'?/Restoration failed/:fault==='initial-read'?/Initial read failed/:/Original device settings restored/);
  assert.equal(f.sends(),fault==='initial-read'?0:2);
  if(fault!=='restore-failed')for(const k of kinds)assert.deepEqual(f.sections[k],f.before[k]);
 }else{
  const r=await run();assert.equal(r.verified,true);assert.equal(r.changed,true);assert.equal(f.sends(),1);
  const expected=Buffer.from(f.before[entry.kind]);for(const [offset,value] of Object.entries(entry.patch))expected[offset]=value;
  for(const k of kinds)assert.deepEqual(f.sections[k],k===entry.kind?expected:f.before[k],`INIT${k}`);
  assert.equal(r.highlight,f.sections[17][4]);assert.deepEqual(r.saturation,[...f.sections[17].subarray(0,3)]);
  assert.equal((await run()).changed,false);assert.equal(f.sends(),1);
 }
});
test('unrelated calibration corruption fails preservation and is not silently overwritten',async t=>{
 const f=fixture(t);let writes=0;
 const adapter={transaction:fn=>f.adapter.transaction(device=>fn({...device,send:p=>{device.send(p);if(++writes===1)f.sections[24][0]^=1;}}))};
 await assert.rejects(applyHighlight(adapter,f.root,true,{wait:async()=>{}}),/Restoration failed/);
 assert.deepEqual(f.sections[17],f.before[17]);assert.notDeepEqual(f.sections[24],f.before[24]);
});
test('each setting only guards its own stored value',async t=>{
 const f=fixture(t);f.sections[1][3]=99;f.sections[1][12]=99;
 assert.equal((await applyAutoCalibration(f.adapter,f.root,true,{wait:async()=>{}})).autoCalibration,1);
 f.sections[17][4]=9;
 await assert.rejects(applyHighlight(f.adapter,f.root,true),/Unsupported/);
 assert.equal(f.sends(),1);
});
test('Auto light off disable preserves delay; enabling validates explicit minutes',async t=>{
 const f=fixture(t);f.sections[1][8]=1;f.sections[1][9]=0;
 const result=await applyAutoLightOff(f.adapter,f.root,{enabled:false},{wait:async()=>{}});
 assert.equal(result.autoLightOff,0);assert.equal(result.autoLightOffMinutes,0);
 for(const minutes of [1,30])assert.equal((await applyAutoLightOff(f.adapter,f.root,{enabled:true,minutes},{wait:async()=>{}})).autoLightOffMinutes,minutes);
});
test('invalid requests are rejected before any hardware access',async()=>{
 const adapter={transaction:()=>assert.fail('Unexpected hardware access')};
 for(const fn of [applyAutoCalibration,applyHighlight])for(const value of [0,1,'true',null,undefined,{}])await assert.rejects(fn(adapter,'',value),/enabled or disabled/);
 for(const value of [null,{},true,{enabled:1},{enabled:true},{enabled:true,minutes:0},{enabled:true,minutes:31},{enabled:true,minutes:1.5},{enabled:true,minutes:'1'},{enabled:false,minutes:NaN}])await assert.rejects(applyAutoLightOff(adapter,'',value));
 for(const value of [null,{},[64,64],[64,64,64,64],[63,64,64],[64,256,64],[64,64,1.5],[64,'64',64],new Array(3)])await assert.rejects(applySaturation(adapter,'',value),/three integers/);
});
test('readback exposes raw values and disables unrecognized settings',()=>{
 const d=Buffer.alloc(24,7),l=Buffer.alloc(24,12),s=readSettings(d,l);
 assert.equal(s.canEditAutoCalibration,false);assert.equal(s.canEditAutoLightOff,false);assert.equal(s.canEditHighlight,false);assert.equal(s.canEditSaturation,false);
 assert.deepEqual(s.saturation,[12,12,12]);assert.throws(()=>readSettings(d,Buffer.alloc(23)),/Incomplete lighting/);
});
