'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {parseCalibration,visibleCalibrationRecords,encodeSingleModel}=require('./calibration');
const {HeAdapter}=require('./he-adapter');
test('record boundaries, unsigned sensor values and incomplete data',()=>{
 const raw=Buffer.alloc(420);raw.set([1,7,0x34,0x12,0x78,0x96],414);
 const records=parseCalibration(raw);assert.equal(records.length,70);
 assert.deepEqual(records[69],{row:4,col:13,model:1,reserved:7,min:0x1234,max:0x9678,rangeStatus:'ok'});
 assert.equal(records[0].rangeStatus,'empty');raw.writeUInt16LE(2000,2);raw.writeUInt16LE(2200,4);assert.equal(parseCalibration(raw)[0].rangeStatus,'not-calibrated');raw.writeUInt16LE(12,2);assert.equal(parseCalibration(raw)[0].rangeStatus,'ok');
 for(const size of [0,419,421])assert.throws(()=>parseCalibration(Buffer.alloc(size)),/420/);
});
test('reading calibration only requests INIT24 and backs up every byte',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'m6-calibration-'));
 try{
  const raw=Buffer.alloc(420,17),adapter=new HeAdapter(dir);let reads=0;
  adapter.transaction=fn=>fn({readInit:kind=>{assert.equal(kind,24);reads++;return raw;}});
  const result=adapter.readCalibration();assert.equal(reads,1);assert.deepEqual(fs.readFileSync(result.backup),raw);
  assert.equal(result.liveProgressAvailable,false);assert.equal(result.layout.length,64);
  adapter.transaction=fn=>fn({readInit:()=>Buffer.alloc(419)});
  assert.throws(()=>adapter.readCalibration(),/420/);assert.equal(fs.readdirSync(dir).length,1);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('active calibration exposes validated unsolicited live entries separately from INIT24',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'m6-live-calibration-'));
 try {
  const raw=Buffer.alloc(420),payload=Buffer.alloc(20,255);payload.set([8,48,0,0,0]);
  payload[5]=29;payload.writeUInt16LE(1600,6);payload.writeUInt16LE(2601,8);
  const adapter=new HeAdapter(dir),sent=[];
  adapter.transaction=fn=>fn({readInit:(kind,onPayload)=>{assert.equal(kind,24);onPayload?.(payload);return raw;},send:p=>sent.push(p)});
  adapter.calibrationCommand(1);
  const result=adapter.readCalibration();
  assert.equal(result.liveProgressAvailable,true);
  assert.equal(result.live.count,1);
  assert.deepEqual(result.live.records['2:1'],{index:29,id:'2:1',row:2,col:1,min:1600,max:2601,rangeReady:true,rangeStatus:'ok'});
 } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});
test('model-table encoder preserves all four blocks (not a calibration command)',()=>{
 const models=Buffer.alloc(64);models[29]=0x37;
 const packets=encodeSingleModel(models);
 assert.equal(packets.length,4); assert.deepEqual([...packets[0].subarray(0,5)],[8,51,1,0,0]);
 assert.equal(packets[1][4+13],0x37); assert.deepEqual([...packets[3].subarray(0,4)],[8,51,1,3]);
});
test('maps visible calibration records through physical layout gaps',()=>{
 const records=Array.from({length:70},(_,i)=>({row:Math.floor(i/14),col:i%14,min:i,max:i+1}));
 const keys=Array.from({length:64},(_,i)=>({id:String(i),row:Math.floor(i/14),col:i%14})); keys[29]={id:'A',row:2,col:1}; keys[40]={id:'ISO',row:2,col:13};
 const mapped=visibleCalibrationRecords(records,keys); assert.equal(mapped[29].min,29); assert.equal(mapped[40].min,41);
});
test('selected calibration starts the confirmed manual flow for one key',()=>{
 const adapter=new HeAdapter('unused'),raw=Buffer.alloc(420,17),sent=[];
 adapter.transaction=fn=>fn({readInit:()=>raw,send:packet=>sent.push(Buffer.from(packet))});
 const result=adapter.calibrateSelected('2:1');
 assert.equal(result.selectedId,'2:1');
 assert.deepEqual([...sent[0].subarray(0,3)],[8,48,1]);
 assert.throws(()=>adapter.calibrateSelected('9:99'),/physical switch/);
});
test('manual calibration validates and backs up before sending a command',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'m6-manual-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const adapter=new HeAdapter(dir), raw=Buffer.alloc(420,17),sent=[];
 adapter.transaction=fn=>fn({readInit:()=>raw,send:packet=>{
   const files=fs.readdirSync(dir).filter(name=>name.endsWith(".bin"));
   assert.deepEqual(fs.readFileSync(path.join(dir,files[files.length-1])),raw);
   sent.push(Buffer.from(packet));
 }});
 for(const command of [1,2,3])adapter.calibrationCommand(command);
 assert.deepEqual(sent.map(p=>[...p.subarray(0,3)]),[[8,48,1],[8,48,2],[8,48,3]]);
 assert.equal(fs.readdirSync(dir).filter(name=>name.endsWith(".bin")).length,3);
 adapter.transaction=fn=>fn({readInit:()=>Buffer.alloc(419),send:()=>assert.fail('Invalid backup must prevent write')});
 assert.throws(()=>adapter.calibrationCommand(1),/420/);
 assert.throws(()=>adapter.calibrationCommand(4),/Unsupported/);
});
test('calibration reset sends 08 30 04 and verifies all records at baseline',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'m6-calibration-reset-'));
 try{
  const before=Buffer.alloc(420);for(let i=0;i<70;i++){before[i*6]=i%2;before.writeUInt16LE(1700+i,i*6+2);before.writeUInt16LE(2600+i,i*6+4);}
  const after=Buffer.from(before);for(let i=0;i<70;i++){after.writeUInt16LE(2000,i*6+2);after.writeUInt16LE(2200,i*6+4);}
  const adapter=new HeAdapter(dir),sent=[];let writes=0;
  adapter.transaction=fn=>fn({readInit:()=>Buffer.from(writes?after:before),send:packet=>{writes++;sent.push(Buffer.from(packet));}});
  const result=adapter.resetCalibration();
  assert.equal(result.verified,true);assert.equal(result.resetCount,70);assert.deepEqual([...sent[0].subarray(0,3)],[8,48,4]);
  assert.deepEqual(fs.readFileSync(result.backup),before);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('calibration reset rejects incomplete readback and keeps the backup',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'m6-calibration-reset-fail-'));
 try{
  const before=Buffer.alloc(420),after=Buffer.from(before);after.writeUInt16LE(1999,2);
  const adapter=new HeAdapter(dir),writes=[];adapter.transaction=fn=>fn({readInit:()=>Buffer.from(writes.length?after:before),send:p=>writes.push(p)});
  assert.throws(()=>adapter.resetCalibration(),/readback mismatch/);assert.equal(writes.length,1);assert.equal(fs.readdirSync(dir).filter(name=>name.endsWith('.bin')).length,2);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('comparison detects visible, hidden, model and reserved changes independently',()=>{
 const layout=require('./keyboard-layout.json');
 const {compareCalibration}=require('./calibration');
 const before=Buffer.alloc(420),after=Buffer.from(before);
 after.writeUInt16LE(1700,29*6+2);after.writeUInt16LE(2600,29*6+4);
 const hidden=Array.from({length:70},(_,i)=>i).find(i=>!layout.some(k=>k.row*14+k.col===i));
 after[hidden*6+1]=7;
 const last=layout[layout.length-1],lastIndex=last.row*14+last.col;
 after[lastIndex*6]=1;
 const result=compareCalibration(before,after,layout);
 assert.equal(result.changedRecords.length,3);assert.equal(result.changedKeys.length,2);
 assert.equal(result.changedKeys[0].id,'2:1');assert.equal(result.changedKeys[0].rangeChanged,true);
 assert.equal(result.hiddenRecordChanges,1);assert.equal(result.unchangedKeyCount,62);
 assert.equal(result.changedKeys[1].modelChanged,true);assert.equal(result.changedKeys[1].rangeChanged,false);
 assert.equal(compareCalibration(before,before,layout).unchanged,true);
});

test('finish compares against start backup, retains baseline after read failure and records evidence',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'m6-cycle-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const adapter=new HeAdapter(dir);let raw=Buffer.alloc(420),fail=false,sends=0;
 adapter.transaction=fn=>fn({readInit:()=>{if(fail)throw Error('Disconnected');return raw;},send:()=>sends++});
 const start=adapter.calibrationCommand(1);
 assert.throws(()=>adapter.calibrationCommand(1),/already active/);assert.equal(sends,1);
 raw=Buffer.from(raw);raw.writeUInt16LE(1658,29*6+2);raw.writeUInt16LE(2613,29*6+4);
 adapter.calibrationCommand(2);fail=true;
 assert.throws(()=>adapter.readCalibration(),/Disconnected/);fail=false;
 const {comparison}=adapter.readCalibration();
 assert.equal(comparison.baselineBackup,start.backup);assert.equal(comparison.phase,'finished');
 assert.equal(comparison.changedKeys[0].id,'2:1');assert.equal(comparison.unchangedKeyCount,63);
 assert.equal(comparison.persistenceVerified,false);
 assert.equal(JSON.parse(fs.readFileSync(comparison.report)).changedKeys.length,1);
 assert.equal(sends,2);
});

for(const scenario of ['selected','neighbor','hidden','unchanged','model','active'])test(`Selected calibration isolation: ${scenario}`,t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'m6-scope-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const adapter=new HeAdapter(dir);let raw=Buffer.alloc(420);
 for(let i=0;i<70;i++){raw.writeUInt16LE(2000,i*6+2);raw.writeUInt16LE(2200,i*6+4);}
 adapter.transaction=fn=>fn({readInit:()=>Buffer.from(raw),send:()=>{}});
 adapter.calibrateSelected('2:1');
 if(scenario!=='unchanged'){raw.writeUInt16LE(1700,29*6+2);raw.writeUInt16LE(2600,29*6+4);}
 if(scenario==='neighbor')raw.writeUInt16LE(1700,30*6+2);
 if(scenario==='hidden'){const layout=require('./keyboard-layout.json');const index=Array.from({length:70},(_,i)=>i).find(i=>!layout.some(k=>k.row*14+k.col===i));raw[index*6+1]=1;}
 if(scenario==='model')raw[29*6]=1;
 if(scenario!=='active')adapter.calibrationCommand(2);
 const comparison=adapter.readCalibration().comparison,scope=comparison.selectedScope;
 assert.equal(scope.verified,scenario==='selected');
 assert.equal(scope.otherRecordsUnchanged,!['neighbor','hidden'].includes(scenario));
 assert.equal(scope.selectedChanged,scenario!=='unchanged');
 assert.deepEqual(JSON.parse(fs.readFileSync(comparison.report)).selectedScope,scope);
});

for(const phase of ['active','finished','canceled','pending'])test(`Calibration journal recovery: ${phase}`,t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'m6-journal-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const adapter=new HeAdapter(dir);let raw=Buffer.alloc(420),fail=false;
 adapter.transaction=fn=>fn({readInit:()=>Buffer.from(raw),send:()=>{if(fail)throw Error('USB lost');}});
 const start=adapter.calibrateSelected('2:1');
 if(phase==='pending'){fail=true;assert.throws(()=>adapter.calibrationCommand(2),/USB lost/);}
 else if(phase!=='active')adapter.calibrationCommand(phase==='finished'?2:3);
 const restored=new HeAdapter(dir),state=restored.calibrationState();
 assert.equal(state.recovered,true);assert.equal(state.active,false);assert.equal(state.selectedId,'2:1');
 assert.equal(state.phase,['active','pending'].includes(phase)?'interrupted':phase);
 assert.equal(state.baselineBackup,start.backup);
 restored.transaction=fn=>fn({readInit:()=>raw,send:()=>assert.fail('Recovery must not write to device')});
 const result=restored.readCalibration();assert.equal(result.comparison.baselineBackup,start.backup);
 assert.equal(result.comparison.selectedScope.verified,false);
});

for(const damage of ['json','missing','checksum','path'])test(`Calibration journal rejects ${damage}`,t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'m6-journal-bad-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const a=new HeAdapter(dir);a.transaction=fn=>fn({readInit:()=>Buffer.alloc(420),send:()=>{}});
 const {backup}=a.calibrationCommand(1),file=path.join(dir,'calibration-session.json');
 if(damage==='json')fs.writeFileSync(file,'{');
 if(damage==='missing')fs.unlinkSync(backup);
 if(damage==='checksum')fs.writeFileSync(backup,Buffer.alloc(420,1));
 if(damage==='path'){const saved=JSON.parse(fs.readFileSync(file));saved.baseline='../outside.bin';fs.writeFileSync(file,JSON.stringify(saved));}
 const restored=new HeAdapter(dir);assert.ok(restored.calibrationState().recoveryError);assert.equal(restored.calibrationState().active,false);
});

test('cancel preservation is verified by all bytes, not command acknowledgement',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'m6-cancel-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const adapter=new HeAdapter(dir);let raw=Buffer.alloc(420);
 adapter.transaction=fn=>fn({readInit:()=>raw,send:()=>{}});
 adapter.calibrationCommand(1);adapter.calibrationCommand(3);
 assert.equal(adapter.readCalibration().comparison.cancelVerified,true);
 raw=Buffer.from(raw);raw[29*6+1]=1;
 assert.equal(adapter.readCalibration().comparison.cancelVerified,false);
});

test('session status is read-only and reflects accepted commands, not hardware verification',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'m6-session-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const adapter=new HeAdapter(dir);let writes=0;
 adapter.transaction=fn=>fn({readInit:()=>Buffer.alloc(420),send:()=>writes++});
 assert.equal(adapter.calibrationState().phase,'idle');assert.equal(writes,0);
 const start=adapter.calibrationCommand(1);
 assert.deepEqual(adapter.calibrationState(),{active:true,phase:'active',baselineBackup:start.backup,source:'application-session',deviceStateVerified:false});
 adapter.calibrationCommand(2);assert.equal(adapter.calibrationState().active,false);
 assert.equal(adapter.calibrationState().phase,'finished');assert.equal(writes,2);
});

test('selected model preparation respects physical gaps and preserves unknown models',()=>{
 const {prepareModelChange}=require('./calibration'),order=require('./calibration-key-order.json');
 const raw=Buffer.alloc(420);for(let i=0;i<70;i++)raw[i*6]=i+2;
 const before=Buffer.from(raw),key=order[40],index=key.row*14+key.col;
 assert.notEqual(index,40);
 const plan=prepareModelChange(raw,order,[key.id,key.id],1);
 assert.equal(plan.changes.length,1);assert.equal(plan.changes[0].recordIndex,index);
 const encoded=Buffer.concat(plan.packets.map(b=>b.subarray(4)));
 for(let i=0;i<64;i++)assert.equal(encoded[i],i===40?1:raw[(order[i].row*14+order[i].col)*6]);
 assert.deepEqual(Buffer.concat(plan.restorePackets.map(b=>b.subarray(4))),plan.originalModels);
 assert.deepEqual(raw,before);assert.equal(plan.calibrationPreservationVerified,false);
});
test('model preparation rejects ambiguous maps/unknown switches and emits no no-op packets',()=>{
 const {prepareModelChange}=require('./calibration'),order=require('./calibration-key-order.json'),raw=Buffer.alloc(420);
 assert.equal(prepareModelChange(raw,order,['2:1'],0).packets.length,0);
 for(const ids of [[],['missing']])assert.throws(()=>prepareModelChange(raw,order,ids,1));
 assert.throws(()=>prepareModelChange(raw,order,['2:1'],2));
 const duplicate=order.slice();duplicate[1]=duplicate[0];assert.throws(()=>prepareModelChange(raw,duplicate,['2:1'],1),/map/);
});
