'use strict';
const HID = require('node-hid');
const fs = require('node:fs');
const path = require('node:path');
const { HeDevice } = require('./he-device');
const { fields, COLS } = require('./he-protocol');
const layout = require('./keyboard-layout.json');
const { decodeCalibrationPayload, mergeCalibrationEntries } = require('./calibration-telemetry');
const { decodeInputReport } = require('./hid-frame');
const {parseProgrammingProfile,encodePair,encodeModRestore,encodeFullModRestore,encodeStandardRemap,encodeModify,encodeLayer,encodeLayerRestore,encodeProgrammingReset,encodeHotKey,encodeMedia,encodeDks,encodeDksRestore,countMacroSteps,PROFILE_SIZE,DKS_MOUSE_ACTIONS,buildDksRecord}=require('./key-programming');

function millimetresToRaw(value) {
  if (!Number.isFinite(value) || value < 0 || value > 3.3) throw new RangeError('Travel must be between 0 and 3.3 mm');
  const raw = value*500;
  if (Math.abs(raw-Math.round(raw)) > 1e-7) throw new RangeError('Travel must use 0.002 mm increments');
  return Math.round(raw);
}
function byteRange(value,name){if(!Number.isInteger(value)||value<0||value>255)throw new RangeError(`Invalid ${name}`);}
function displayKey(key) {
  return {...key, rtOn: !!key.rtOn, ...Object.fromEntries(fields.map(f=>[f,key[f]/500]))};
}
class HeAdapter {
  constructor(backupDir) {
    this.backupDir=backupDir;
    this.calibrationLive=new Map();
    this.calibrationLiveUpdatedAt=null;
    this.calibrationTelemetryHandle=null;
    this.calibrationTelemetryFrames=0;
    this.calibrationTelemetryRejected=0;
    const journal=path.join(backupDir,'calibration-session.json');
    try{
      if(fs.existsSync(journal)){
        const saved=JSON.parse(fs.readFileSync(journal,'utf8'));
        if(saved.schema!==1||!['pending','active','finished','canceled'].includes(saved.phase)||
          typeof saved.baseline!=='string'||path.basename(saved.baseline)!==saved.baseline||
          !/^calibration-command-[a-f0-9-]+\.bin$/.test(saved.baseline)||
          saved.selectedId!==undefined&&!layout.some(k=>k.id===saved.selectedId))throw Error('Invalid session journal');
        const backup=path.join(backupDir,saved.baseline),raw=fs.readFileSync(backup);
        require('./calibration').parseCalibration(raw);
        if(require('node:crypto').createHash('sha256').update(raw).digest('hex')!==saved.sha256)throw Error('Calibration baseline checksum differs');
        this.calibrationSession={backup,phase:['pending','active'].includes(saved.phase)?'interrupted':saved.phase,
          ...(saved.selectedId?{selectedId:saved.selectedId}:{}),recovered:true};
      }
    }catch(error){this.calibrationRecoveryError=error.message;}
  }
  persistCalibrationSession(session) {
    const raw=fs.readFileSync(session.backup),journal=path.join(this.backupDir,'calibration-session.json');
    const saved={schema:1,baseline:path.basename(session.backup),phase:session.phase,
      sha256:require('node:crypto').createHash('sha256').update(raw).digest('hex'),
      ...(session.selectedId?{selectedId:session.selectedId}:{})};
    const temporary=journal+'.'+require('node:crypto').randomUUID()+'.tmp';
    fs.writeFileSync(temporary,JSON.stringify(saved,null,2),{flag:'wx'});
    fs.renameSync(temporary,journal);
  }
  saveToDeviceMemory() {
    return this.transaction(device=>{
      fs.mkdirSync(this.backupDir,{recursive:true});
      const backup=path.join(this.backupDir,`save-memory-${require('node:crypto').randomUUID()}`);fs.mkdirSync(backup,{recursive:true});
      for(const kind of [1,2,4,24,25,26,6,7,9,17]){const raw=device.readInit(kind);fs.writeFileSync(path.join(backup,`before-${kind}.bin`),raw);}
      const payload=Buffer.alloc(20);payload.set([8,0xf2]);device.send(payload);fs.writeFileSync(path.join(backup,'save-command.bin'),payload);
      return {verified:true,acknowledged:true,backup,command:'SAVE_END',persistence:'Pending power-cycle verification'};
    });
  }
  calibrationState() {
    const session=this.calibrationSession;
    return {active:session?.phase==='active',phase:session?.phase??'idle',
      baselineBackup:session?.backup??null,source:session?.recovered?'saved-session':'application-session',deviceStateVerified:false,
      ...(session?.recovered?{recovered:true}:{}),
      ...(this.calibrationRecoveryError?{recoveryError:this.calibrationRecoveryError}:{}),
      ...(session?.selectedId?{selectedId:session.selectedId}:{})};
  }
  startCalibrationTelemetry() {
    if(this.calibrationTelemetryHandle)return;
    const info=HID.devices().find(d=>Number(d.vendorId)===0x2233&&Number(d.productId)===0x006b&&Number(d.interface)===2&&Number(d.usagePage)===12);
    if(!info){this.calibrationTelemetryError='M6 Lite+ configuration interface MI02 not detected';return;}
    try{
      const handle=new HID.HID(info.path);
      handle.on('data',report=>{
        this.calibrationTelemetryFrames++;
        try{
          const payload=decodeInputReport(Buffer.from(report));
          const decoded=decodeCalibrationPayload(payload,require('./calibration-key-order.json'));
          if(decoded?.entries?.length){mergeCalibrationEntries(this.calibrationLive,decoded.entries);this.calibrationLiveUpdatedAt=new Date().toISOString();}
        }catch{this.calibrationTelemetryRejected++;}
      });
      handle.on('error',error=>{this.calibrationTelemetryError=error.message;});
      this.calibrationTelemetryHandle=handle;this.calibrationTelemetryError=null;
    }catch(error){this.calibrationTelemetryError=error.message;}
  }
  stopCalibrationTelemetry() {
    const handle=this.calibrationTelemetryHandle;this.calibrationTelemetryHandle=null;
    if(handle){try{handle.removeAllListeners();handle.close();}catch{}}
  }
  transaction(action) {
    const info=HID.devices().find(d=>Number(d.vendorId)===0x2233 && Number(d.productId)===0x006b && Number(d.interface)===2 && Number(d.usagePage)===12);
    if(!info) throw new Error('M6 Lite+ configuration interface MI02 not detected');
    const handle=new HID.HID(info.path);
    try { return action(new HeDevice(handle)); } finally { handle.close(); }
  }
  readCalibration() {
    return this.transaction(device=>{
      const liveActive=this.calibrationSession?.phase==='active';
      const onPayload=liveActive ? payload=>{
        try {
          const decoded=decodeCalibrationPayload(payload, require('./calibration-key-order.json'));
          if(decoded?.entries?.length){mergeCalibrationEntries(this.calibrationLive,decoded.entries);this.calibrationLiveUpdatedAt=new Date().toISOString();}
        } catch { /* unrelated or incomplete unsolicited frames are ignored */ }
      } : undefined;
      const raw=device.readInit(24,onPayload);
      const records=require('./calibration').parseCalibration(raw);
      fs.mkdirSync(this.backupDir,{recursive:true});
      const backup=path.join(this.backupDir,`calibration-${require('node:crypto').randomUUID()}.bin`);
      fs.writeFileSync(backup,raw,{flag:'wx'});
      let comparison=null;
      if(this.calibrationSession){
        const session=this.calibrationSession;
        comparison={...require('./calibration').compareCalibration(fs.readFileSync(session.backup),raw,layout),
          phase:session.phase,baselineBackup:session.backup,
          cancelVerified:session.phase==='canceled'?fs.readFileSync(session.backup).equals(raw):null,
          persistenceVerified:false};
        if(session.selectedId){
          const selectedChange=comparison.changedKeys.find(k=>k.id===session.selectedId);
          const unexpected=comparison.changedRecords.filter(k=>k.id!==session.selectedId);
          comparison.selectedScope={id:session.selectedId,
            selectedChanged:!!selectedChange,otherRecordsUnchanged:unexpected.length===0,
            unexpectedRecords:unexpected.map(k=>({index:k.index,id:k.id,label:k.label})),
            verified:session.phase==='finished'&&!!selectedChange&&unexpected.length===0&&
              selectedChange.rangeChanged&&!selectedChange.modelChanged&&!selectedChange.reservedChanged&&selectedChange.after.rangeStatus==='ok'};
        }
        const report=backup.replace(/\.bin$/,'.json');
        fs.writeFileSync(report,JSON.stringify(comparison,null,2),{flag:'wx'});
        comparison.report=report;
      }
      const visible=require('./calibration').visibleCalibrationRecords(records,layout);
      const liveEntries=liveActive?[...this.calibrationLive.values()]:[];
      const liveRecords=Object.fromEntries(liveEntries.map(entry=>[entry.id,{...entry}]));
      return {records,visible,layout,backup,comparison,readAt:new Date().toISOString(),
        liveProgressAvailable:liveActive&&liveEntries.length>0,
        live: {active:liveActive,available:liveActive&&liveEntries.length>0,count:liveEntries.length,updatedAt:liveActive?this.calibrationLiveUpdatedAt:null,frames:liveActive?this.calibrationTelemetryFrames:0,rejected:liveActive?this.calibrationTelemetryRejected:0,error:liveActive?this.calibrationTelemetryError:null,records:liveRecords},
        statusSummary:visible.reduce((summary,key)=>(summary[key.rangeStatus]=(summary[key.rangeStatus]||0)+1,summary),{})};
    });
  }
  calibrationCommand(command,selectedId) {
    if (![1, 2, 3].includes(command)) throw new RangeError('Unsupported calibration command');
    if(command===1&&this.calibrationSession?.phase==='active')throw new Error('Calibration is already active');
    if(command!==1)this.stopCalibrationTelemetry();
    const result=this.transaction(device => {
      fs.mkdirSync(this.backupDir,{recursive:true});
      const before=device.readInit(24);
      require('./calibration').parseCalibration(before);
      const backup=path.join(this.backupDir,`calibration-command-${require('node:crypto').randomUUID()}.bin`);
      fs.writeFileSync(backup,before,{flag:'wx'});
      if(command===1){this.calibrationLive.clear();this.calibrationLiveUpdatedAt=null;this.calibrationTelemetryFrames=0;this.calibrationTelemetryRejected=0;this.calibrationTelemetryError=null;}
      const session=command===1?{backup,...(selectedId?{selectedId}:{})}:this.calibrationSession||{backup};
      this.persistCalibrationSession({...session,phase:'pending'});
      const payload=Buffer.alloc(20); payload.set([8,48,command]); device.send(payload);
      this.calibrationSession={...session,phase:command===1?'active':command===2?'finished':'canceled'};
      try{this.persistCalibrationSession(this.calibrationSession);}
      catch(error){throw new Error(`Calibration command was sent, but session journal update failed: ${error.message}. Reopen Calibration to inspect the session; do not repeat the command.`);}
      this.calibrationRecoveryError=null;
      return {command,backup,started:command===1,finished:command===2,canceled:command===3};
    });
    if(command===1)this.startCalibrationTelemetry();
    return result;
  }
  resetCalibration() {
    return this.transaction(device=>{
      fs.mkdirSync(this.backupDir,{recursive:true});
      const before=device.readInit(24);
      require('./calibration').parseCalibration(before);
      const backup=path.join(this.backupDir,`calibration-reset-${require('node:crypto').randomUUID()}.bin`);
      fs.writeFileSync(backup,before,{flag:'wx'});
      const payload=Buffer.alloc(20);payload.set([8,48,4]);
      device.send(payload);
      let after;
      try { after=device.readInit(24); }
      catch(error){throw new Error(`Calibration reset command was sent, but readback failed: ${error.message}. Backup: ${backup}`);}
      const records=require('./calibration').parseCalibration(after);
      const invalid=records.filter(record=>record.min!==2000||record.max!==2200);
      if(invalid.length){
        const actual=backup.replace(/\.bin$/,'.actual.bin');
        fs.writeFileSync(actual,after,{flag:'wx'});
        throw new Error(`Calibration reset readback mismatch: ${invalid.length} records are not at 2000 / 2200. Backup: ${backup}. Actual: ${actual}`);
      }
      return {command:4,verified:true,backup,records,layout,resetCount:records.length};
    });
  }
  calibrateSelected(id) {
    if(!layout.some(key=>key.id===id)) throw new Error('Select one physical switch');
    if(this.calibrationSession?.phase==='active')throw new Error('Calibration is already active');
    // M6 Lite+ uses the same manual calibration command for this flow. The
    // selected-key scope is established by the UI: the user presses only the
    // selected switch, then finishes and the saved record is checked for
    // isolation against the session backup.
    const result=this.calibrationCommand(1,id);
    return {...result,selectedId:id,scope:'selected-key'};
  }
  readProfile(layer) {
    return this.transaction(device=>({layer,keys:device.readProfile(layer).keys.map(displayKey),layout}));
  }
  readProgramming(layer) {
    if(layer!==0&&layer!==1)throw new Error('Select M1 or M2');
    return this.transaction(device=>{
      const profile=parseProgrammingProfile(device.readInit(layer===0?2:4));
      return {layer,keys:profile.keys.map(({record,...key})=>key)};
    });
  }
  exportHeProfile(layer) {
    return this.transaction(device=>require('./he-profile-file').exportProfile(device.readProfile(layer),layer));
  }
  importHeProfile(layer,document) {
    const incoming=require('./he-profile-file').validateProfile(document);
    return this.applyHePatch(layer,incoming,'import');
  }
  applyHePatch(layer,incoming,operation='group') {
    if(![0,1].includes(layer))throw new Error('Select M1 or M2');
    return this.transaction(device=>device.withLayer('he',layer,()=>{
      const before=device.readProfile(layer),expected=before.keys.map(key=>({...key}));
      for(const key of incoming)Object.assign(expected[key.row*COLS+key.col],key);
      const changes=expected.filter((key,i)=>JSON.stringify(key)!==JSON.stringify(before.keys[i]));
      fs.mkdirSync(this.backupDir,{recursive:true});
      const backup=path.join(this.backupDir,`${Date.now()}-M${layer+1}-${operation}.bin`);fs.writeFileSync(backup,before.raw,{flag:'wx'});
      const writeBatches=keys=>{
        for(let start=0;start<keys.length;start+=4){
          const batch=keys.slice(start,start+4);for(const key of batch)device.writeKeyRaw(key,layer);
          const observed=device.readProfile(layer);
          if(batch.some(key=>JSON.stringify(observed.keys[key.row*COLS+key.col])!==JSON.stringify(key)))throw new Error('HE batch readback mismatch');
        }
      };
      try{
        writeBatches(changes);
        const after=device.readProfile(layer);
        if(JSON.stringify(after.keys)!==JSON.stringify(expected))throw new Error('HE profile readback mismatch');
        return {layer,keys:after.keys.map(displayKey),layout,backup,changed:changes.length};
      }catch(error){
        try{
          writeBatches(changes.map(key=>before.keys[key.row*COLS+key.col]));
          if(JSON.stringify(device.readProfile(layer).keys)!==JSON.stringify(before.keys))throw new Error('Restoration mismatch');
        }catch(restoreError){throw new Error(`${error.message}. Restoration failed: ${restoreError.message}. Backup: ${backup}`);}
        throw new Error(`${error.message}. Original HE profile restored. Backup: ${backup}`);
      }
    }));
  }
  setPair(request) {
    const {layer,mode,first,second}=request;
    if(layer!==0&&layer!==1)throw new Error('Select M1 or M2');
    if(![0,5,6].includes(mode))throw new Error('Select Snap Tap, SOCD or Disabled');
    const physical=[first,second].map(id=>layout.find(key=>key.id===id));
    if(physical.some(key=>!key)||first===second)throw new Error('Select two different physical keys');
    return this.transaction(device=>device.withLayer('programming',layer,()=>{
      const raw=device.readInit(layer===0?2:4),before=parseProgrammingProfile(raw);
      const indices=physical.map(key=>key.row*COLS+key.col);
      const keys=indices.map(i=>before.keys[i]);
      for(let i=0;i<2;i++) {
        const key=keys[i],partner=keys[1-i];
        if(![0,5,6].includes(key.mode))throw new Error('A selected key uses another advanced mode. Restore its standard assignment first.');
        if(key.mode!==0){const target=key.mode===5?key.snap:key.cancel;
          if(target.row!==partner.row+1||target.col!==partner.col)throw new Error('A selected key is paired with another switch. Disable that pair first.');}
      }
      for(const key of before.keys){
        if(indices.includes(key.row*COLS+key.col)||![5,6].includes(key.mode))continue;
        const target=key.mode===5?key.snap:key.cancel;
        if(keys.some(k=>target.row===k.row+1&&target.col===k.col))throw new Error('Another switch points to this pair. Disable the existing pair first.');
      }
      const allSteps=countMacroSteps(before.keys),expected=Buffer.from(raw);
      const commands=keys.map((key,i)=>{
        const offset=8+indices[i]*68;expected[offset]=mode;
        if(mode===0)return encodeModRestore({...key,mode:0},layer,allSteps);
        const target={row:keys[1-i].row+1,col:keys[1-i].col};
        const field=mode===5?64:66;expected[offset+field]=target.row;expected[offset+field+1]=target.col;
        return encodePair(key,layer,allSteps,mode,target);
      });
      const restore=keys.flatMap(key=>{
        const packets=[];
        // Restore the partner field modified by this operation, even if inactive.
        if(mode!==0)packets.push(encodePair(key,layer,allSteps,mode,mode===5?key.snap:key.cancel));
        if(key.mode===0)packets.push(...encodeFullModRestore(key,layer,allSteps));
        else packets.push(encodePair(key,layer,allSteps,key.mode,key.mode===5?key.snap:key.cancel));
        return packets;
      });
      fs.mkdirSync(this.backupDir,{recursive:true});
      const backup=path.join(this.backupDir,`${Date.now()}-M${layer+1}-pair.bin`);
      fs.writeFileSync(backup,raw,{flag:'wx'});
      try{
        for(const command of commands)device.send(command);
        const afterRaw=device.readInit(layer===0?2:4);
        if(!afterRaw.equals(expected))throw new Error('Pair change did not match device readback');
        return {verified:true,layer,backup,keys:parseProgrammingProfile(afterRaw).keys.map(({record,...key})=>key)};
      }catch(error){
        const errors=[];
        for(const command of restore){try{device.send(command);}catch(e){errors.push(e.message);}}
        let restored;
        for(let attempt=0;attempt<3;attempt++){
          try{restored=device.readInit(layer===0?2:4);break;}catch(e){errors.push(e.message);}
        }
        if(restored)fs.writeFileSync(backup+'.restored',restored);
        const status=restored?.equals(raw)?'Original pair restored':restored?.subarray(4).equals(raw.subarray(4))?'Original pair settings restored; profile UID differs':'Pair restoration could not be verified';
        throw new Error(`${error.message}. ${status}. ${errors.join('; ')} Backup: ${backup}`);
      }
    }));
  }
  setRemap({layer,source,target}) {
    if(![0,1].includes(layer))throw new Error('Select M1 or M2');
    const from=layout.find(k=>k.id===source),to=layout.find(k=>k.id===target);
    if(!from||!to||source===target)throw new Error('Select different source and target keys');
    return this.transaction(device=>device.withLayer('programming',layer,()=>{
      const kind=layer===0?2:4,raw=device.readInit(kind),before=parseProgrammingProfile(raw),index=from.row*COLS+from.col,key=before.keys[index];
      if(key.mode!==0)throw new Error('Source must use Standard mode before remapping');
      const expected=Buffer.from(raw),offset=8+index*68;expected[offset]=0;expected[offset+1]=key.locked;expected[offset+64]=to.row;expected[offset+65]=to.col;
      const backup=path.join(this.backupDir,`${Date.now()}-M${layer+1}-remap.bin`);fs.mkdirSync(this.backupDir,{recursive:true});fs.writeFileSync(backup,raw,{flag:'wx'});
      try{
        device.send(encodeStandardRemap(key,layer,before.allSteps,{row:to.row,col:to.col}));
        const after=device.readInit(kind);
        if(!after.subarray(0,PROFILE_SIZE).equals(expected.subarray(0,PROFILE_SIZE))){fs.writeFileSync(backup+'.actual',after);throw new Error('Remap full-profile readback mismatch');}
        return {verified:true,layer,source,target,backup,keys:parseProgrammingProfile(after).keys.map(({record,...x})=>x)};
      }catch(error){
        try{
          device.send(encodeStandardRemap(key,layer,before.allSteps,key.snap));
          if(!device.readInit(kind).subarray(0,PROFILE_SIZE).equals(raw.subarray(0,PROFILE_SIZE)))throw new Error('Restoration readback mismatch');
        }catch(restoreError){throw new Error(`${error.message}. Restoration failed: ${restoreError.message}. Backup: ${backup}`);}
        throw new Error(`${error.message}. Original remap restored. Backup: ${backup}`);
      }
    }));
  }
  setHotKey({layer,id,interval}) {
    if(![0,1].includes(layer))throw new Error('Select M1 or M2');
    const source=layout.find(k=>k.id===id);
    if(!source)throw new Error('Select a physical source key');
    if(!Number.isInteger(interval)||interval<0||interval>65535)throw new Error('Invalid HotKey interval');
    return this.transaction(device=>device.withLayer('programming',layer,()=>{
      const kind=layer===0?2:4,raw=device.readInit(kind),before=parseProgrammingProfile(raw),index=source.row*COLS+source.col,key=before.keys[index];
      if(key.mode!==0)throw new Error('Source must use Standard mode before HotKey');
      const expected=Buffer.from(raw),offset=8+index*68;expected[offset+16]=2;expected.writeUInt16LE(interval,offset+17);
      const backup=path.join(this.backupDir,`${Date.now()}-M${layer+1}-hotkey.bin`);fs.mkdirSync(this.backupDir,{recursive:true});fs.writeFileSync(backup,raw,{flag:'wx'});
      device.send(encodeHotKey(key,layer,before.allSteps,interval));
      const after=device.readInit(kind),observed=parseProgrammingProfile(after).keys[index];
      if(observed.hotKey.type!==2||observed.hotKey.interval!==interval){
        for(const command of [encodeModRestore(key,layer,before.allSteps)])device.send(command);
        const restored=device.readInit(kind);
        if(!restored.subarray(0,PROFILE_SIZE).equals(raw.subarray(0,PROFILE_SIZE)))throw new Error(`HotKey readback mismatch and rollback failed. Backup: ${backup}`);
        throw new Error(`HotKey readback mismatch; original profile restored. Backup: ${backup}`);
      }
      return {verified:true,layer,id,interval,backup,keys:parseProgrammingProfile(after).keys.map(({record,...x})=>x)};
    }));
  }
  setMedia({layer,id,index,data}) {
    if(![0,1].includes(layer))throw new Error('Select M1 or M2');
    const source=layout.find(k=>k.id===id);if(!source)throw new Error('Select a physical source key');
    byteRange(index,'Media index');byteRange(data,'Media data');
    return this.transaction(device=>device.withLayer('programming',layer,()=>{
      const kind=layer===0?2:4,raw=device.readInit(kind),before=parseProgrammingProfile(raw),position=source.row*COLS+source.col,key=before.keys[position];
      if(![0,2].includes(key.mode))throw new Error('Source must use Standard or Media mode');
      const offset=8+position*68,expected=Buffer.from(raw);expected[offset]=2;expected[offset+2]=index;expected[offset+3]=data;
      // Hardware A Media readback normalizes inactive target and repeat fields.
      expected[offset+9]=source.row+1;expected[offset+10]=source.col;
      expected[offset+17]=0;expected.writeUInt16LE(0,offset+18);
      const backup=path.join(this.backupDir,`${require('node:crypto').randomUUID()}-M${layer+1}-media.bin`);fs.mkdirSync(this.backupDir,{recursive:true});fs.writeFileSync(backup,raw,{flag:'wx'});
      try {
        device.send(encodeMedia(key,layer,before.allSteps,index,data));
        const after=device.readInit(kind),observed=parseProgrammingProfile(after).keys[position];
        if(!after.subarray(0,PROFILE_SIZE).equals(expected.subarray(0,PROFILE_SIZE)))throw new Error('Media readback mismatch or unrelated profile change');
        return {verified:true,layer,id,index,data,backup,keys:parseProgrammingProfile(after).keys.map(({record,...x})=>x)};
      } catch(error) {
        try { try { device.send(encodeMedia(key,layer,before.allSteps,key.media.index,key.media.data)); } finally { if(key.mode===0){const [inactive,original]=encodeFullModRestore(key,layer,before.allSteps); try{device.send(inactive);}finally{device.send(original);}} } const restored=device.readInit(kind); if(!restored.subarray(0,PROFILE_SIZE).equals(raw.subarray(0,PROFILE_SIZE)))throw new Error('Restoration readback mismatch'); }
        catch(restoreError){throw new Error(`${error.message}. Restoration failed: ${restoreError.message}. Backup: ${backup}`);}
        throw new Error(`${error.message}. Original assignment restored. Backup: ${backup}`);
      }
    }));
  }
  returnToStandard({layer,id}) {
    if(![0,1].includes(layer))throw new Error('Select M1 or M2');
    const source=layout.find(k=>k.id===id);if(!source)throw new Error('Select a physical source key');
    return this.transaction(device=>device.withLayer('programming',layer,()=>{
      const kind=layer===0?2:4,raw=device.readInit(kind),before=parseProgrammingProfile(raw),position=source.row*COLS+source.col,key=before.keys[position];
      if(![2,3].includes(key.mode))throw new Error('Select a Media or FN assignment');
      if((key.mode===2&&key.layer.layer!==255)||(key.mode===3&&(key.media.index!==1||key.media.data!==0)))throw new Error('Inactive assignment is not a verified default; no changes made');
      const m=key.modify;
      if(m.type!==0||m.row!==source.row+1||m.col!==source.col||m.mode!==0||m.interval!==0)throw new Error('Saved standard action is not a verified default; no changes made');
      const command=encodeModRestore({...key,mode:0},layer,before.allSteps);
      const restore=key.mode===2?encodeMedia(key,layer,before.allSteps,key.media.index,key.media.data):encodeLayerRestore(key,layer,before.allSteps);
      const expected=Buffer.from(raw),offset=8+position*68;expected[offset]=0;expected[offset+2]=1;expected[offset+3]=0;expected[offset+4]=255;
      const backup=path.join(this.backupDir,`${require('node:crypto').randomUUID()}-standard.bin`);fs.mkdirSync(this.backupDir,{recursive:true});fs.writeFileSync(backup,raw,{flag:'wx'});
      try{device.send(command);const after=device.readInit(kind);if(!after.subarray(0,PROFILE_SIZE).equals(expected.subarray(0,PROFILE_SIZE)))throw new Error('Standard readback mismatch');return {verified:true,layer,id,backup,keys:parseProgrammingProfile(after).keys.map(({record,...x})=>x)};}
      catch(error){try{device.send(restore);if(!device.readInit(kind).subarray(0,PROFILE_SIZE).equals(raw.subarray(0,PROFILE_SIZE)))throw new Error('Restoration readback mismatch');}catch(e){throw new Error(`${error.message}. Restoration failed: ${e.message}. Backup: ${backup}`);}throw new Error(`${error.message}. Original assignment restored. Backup: ${backup}`);}
    }));
  }
  setModify({layer,id,modify}) {
    if(![0,1].includes(layer))throw new Error('Select M1 or M2');
    const source=layout.find(k=>k.id===id);if(!source)throw new Error('Select a physical source key');
    return this.transaction(device=>device.withLayer('programming',layer,()=>{
      const kind=layer===0?2:4,raw=device.readInit(kind),before=parseProgrammingProfile(raw),position=source.row*COLS+source.col,key=before.keys[position];
      if(key.mode!==0)throw new Error('Source must use Standard mode before Modify');
      const normalized={...modify,mode:modify?.mode??0,interval:modify?.interval??0};
      const command=encodeModify(key,layer,before.allSteps,normalized);
      const backup=path.join(this.backupDir,`${require('node:crypto').randomUUID()}-M${layer+1}-modify.bin`);
      fs.mkdirSync(this.backupDir,{recursive:true});fs.writeFileSync(backup,raw,{flag:'wx'});
      try {
        device.send(command);
        const after=device.readInit(kind),parsed=parseProgrammingProfile(after),observed=parsed.keys[position];
        const names=normalized.type===0?['type','row','col','mode','interval']:['type','button','x','y','wheel','mode','interval'];
        if(observed.mode!==0||observed.locked!==key.locked||names.some(name=>observed.modify[name]!==normalized[name]))throw new Error('Modify readback mismatch');
        if(parsed.allSteps!==before.allSteps||parsed.keys.some((other,index)=>index!==position&&!other.record.equals(before.keys[index].record)))throw new Error('Modify changed another key or macro count');
        // Preserve every field outside the selected key's modify structure.
        if(!observed.record.subarray(2,8).equals(key.record.subarray(2,8))||!observed.record.subarray(20).equals(key.record.subarray(20)))throw new Error('Modify changed unrelated assignment data');
        const inactiveRange=normalized.type===0?[11,17]:[9,11];
        const inactiveUnchanged=observed.record.subarray(...inactiveRange).equals(key.record.subarray(...inactiveRange));
        // Observed QC64 mouse conversion resets the inactive keyboard target
        // to the source key (stored row is one-based). Retain other guards.
        const defaultKeyboardTarget=normalized.type===1&&observed.modify.row===source.row+1&&observed.modify.col===source.col;
        if(!inactiveUnchanged&&!defaultKeyboardTarget)throw new Error('Modify changed inactive assignment fields');
        return {verified:true,layer,id,modify:normalized,backup,keys:parsed.keys.map(({record,...x})=>x)};
      }
      catch(error){try{const [inactive,original]=encodeFullModRestore(key,layer,before.allSteps);try{device.send(inactive);}finally{device.send(original);}const restored=device.readInit(kind);if(!restored.subarray(0,PROFILE_SIZE).equals(raw.subarray(0,PROFILE_SIZE)))throw new Error('Restoration readback mismatch');}catch(restoreError){throw new Error(`${error.message}. Restoration failed: ${restoreError.message}. Backup: ${backup}`);}throw new Error(`${error.message}. Original assignment restored. Backup: ${backup}`);}
    }));
  }
  setLayerAssignment({layer,id,targetLayer}) {
    if(![0,1].includes(layer))throw new Error('Select M1 or M2');
    const source=layout.find(k=>k.id===id);if(!source)throw new Error('Select a physical source key');
    if(![0,1,2].includes(targetLayer))throw new Error('Target must be FN1, FN2 or FN3');
    return this.transaction(device=>device.withLayer('programming',layer,()=>{
      const kind=layer===0?2:4,raw=device.readInit(kind),before=parseProgrammingProfile(raw),position=source.row*COLS+source.col,key=before.keys[position];
      if(![0,3].includes(key.mode))throw new Error('Source must use Standard or Layer mode');
      const restoreLayer=encodeLayerRestore(key,layer,before.allSteps);
      const expected=Buffer.from(raw),offset=8+position*68;expected[offset]=3;expected[offset+4]=targetLayer;
      expected[offset+9]=source.row+1;expected[offset+10]=source.col;
      expected[offset+17]=0;expected.writeUInt16LE(0,offset+18);
      const command=encodeLayer(key,layer,before.allSteps,targetLayer),backup=path.join(this.backupDir,`${require('node:crypto').randomUUID()}-M${layer+1}-layer.bin`);fs.mkdirSync(this.backupDir,{recursive:true});fs.writeFileSync(backup,raw,{flag:'wx'});
      try{device.send(command);const after=device.readInit(kind),observed=parseProgrammingProfile(after).keys[position];if(!after.subarray(0,PROFILE_SIZE).equals(expected.subarray(0,PROFILE_SIZE)))throw new Error('Layer readback mismatch or unrelated profile change');return {verified:true,layer,id,targetLayer,backup,keys:parseProgrammingProfile(after).keys.map(({record,...x})=>x)};}
      catch(error){try{try{device.send(restoreLayer);}finally{if(key.mode===0){const [inactive,original]=encodeFullModRestore(key,layer,before.allSteps);try{device.send(inactive);}finally{device.send(original);}}}const restored=device.readInit(kind);if(!restored.subarray(0,PROFILE_SIZE).equals(raw.subarray(0,PROFILE_SIZE)))throw new Error('Restoration readback mismatch');}catch(restoreError){throw new Error(`${error.message}. Restoration failed: ${restoreError.message}. Backup: ${backup}`);}throw new Error(`${error.message}. Original assignment restored. Backup: ${backup}`);}
    }));
  }
  setKeyEnabled({layer,id,enabled}) {
    if(![0,1].includes(layer)||typeof enabled!=='boolean')throw new Error('Select M1/M2 and an enabled state');
    const source=layout.find(k=>k.id===id);if(!source)throw new Error('Select a physical key');
    return this.transaction(device=>device.withLayer('programming',layer,()=>{
      const kind=layer===0?2:4,raw=device.readInit(kind),before=parseProgrammingProfile(raw);
      const position=source.row*COLS+source.col,key=before.keys[position];
      if(![0,2,3,4,5,6].includes(key.mode)||![0,1].includes(key.locked))throw new Error('Unsupported assignment for key enable/disable');
      const locked=enabled?0:1;
      if(key.locked===locked)return {verified:true,changed:false,layer,id,keys:before.keys.map(({record,...k})=>k)};
      const {encodeKeyEnabled}=require('./key-programming');
      const original=encodeKeyEnabled(key,layer,before.allSteps,key.locked===0);
      const command=encodeKeyEnabled(key,layer,before.allSteps,enabled);
      const expected=Buffer.from(raw);expected[8+position*68+1]=locked;
      const backup=path.join(this.backupDir,`key-lock-${require('node:crypto').randomUUID()}.bin`);
      fs.mkdirSync(this.backupDir,{recursive:true});fs.writeFileSync(backup,raw,{flag:'wx'});
      try{
        device.send(command);const after=device.readInit(kind);
        if(!after.equals(expected)){fs.writeFileSync(backup+'.actual',after);throw new Error('Key enable/disable readback mismatch');}
        return {verified:true,changed:true,layer,id,backup,keys:parseProgrammingProfile(after).keys.map(({record,...k})=>k)};
      }catch(error){
        try{device.send(original);const restored=device.readInit(kind);fs.writeFileSync(backup+'.restored',restored);if(!restored.equals(raw))throw new Error('Restoration readback mismatch');}
        catch(restoreError){throw new Error(`${error.message}. Restoration failed: ${restoreError.message}. Backup: ${backup}`);}
        throw new Error(`${error.message}. Original assignment restored. Backup: ${backup}`);
      }
    }));
  }
  resetProgrammingKey({layer,id}) {
    if(![0,1].includes(layer))throw new Error('Select M1 or M2');const source=layout.find(k=>k.id===id);if(!source)throw new Error('Select a physical source key');
    return this.transaction(device=>device.withLayer('programming',layer,()=>{
      const kind=layer===0?2:4,raw=device.readInit(kind),before=parseProgrammingProfile(raw);
      const position=source.row*COLS+source.col,key=before.keys[position],offset=8+position*68;
      const backup=path.join(this.backupDir,`reset-${require('node:crypto').randomUUID()}-M${layer+1}.bin`);
      fs.mkdirSync(this.backupDir,{recursive:true});fs.writeFileSync(backup,raw,{flag:'wx'});
      try{
        device.send(encodeProgrammingReset(key,layer,before.allSteps));
        const after=device.readInit(kind);fs.writeFileSync(backup+'.actual',after);
        const parsed=parseProgrammingProfile(after);
        if(parsed.keys[position].mode!==0||parsed.keys[position].locked!==0)throw new Error('Programming reset readback mismatch: expected Standard mode and cleared lock');
        // Header counters may change when resetting an assignment. Every other
        // physical record must remain byte-identical; mode alone proves neither
        // reset completeness nor isolation.
        if(after.length!==raw.length||!after.subarray(8,offset).equals(raw.subarray(8,offset))||!after.subarray(offset+68,PROFILE_SIZE).equals(raw.subarray(offset+68,PROFILE_SIZE)))
          throw new Error('Programming reset changed an unrelated key');
        const remainingPairSources=parsed.keys.filter(other=>{
          if(![5,6].includes(other.mode))return false;
          const target=other.mode===5?other.snap:other.cancel;
          return target.row===source.row+1&&target.col===source.col;
        }).map(other=>({id:`${other.row}:${other.col}`,mode:other.mode}));
        return {verified:true,layer,id,backup,remainingPairSources,keys:parsed.keys.map(({record,...x})=>x)};
      }catch(error){throw new Error(`${error.message}. Reset not verified; automatic restoration is unavailable for this reset command. Backup: ${backup}`);}
    }));
  }
  setDks(request) {return this.setDksBatch(request.layer,[request]);}
  setDksAll({layer,target,interval}) {
    return this.setDksBatch(layer,layout.map(key=>({id:key.id,target,interval,enabled:true})));
  }
  presetOff({layer}) {
    return this.setQuickPreset({layer,preset:'off'});
  }
  setQuickPreset({layer,preset}) {
    if(![0,1].includes(layer))throw new Error('Select M1 or M2');
    if(!['off','dks','snap'].includes(preset))throw new Error('Select DKS, SNAP or Off');
    return this.transaction(device=>device.withLayer('programming',layer,()=>{
      const read=()=>{let error;for(let i=0;i<3;i++){try{return device.readInit(layer===0?2:4);}catch(e){error=e;}}throw error;};
      const raw=read(),plan=require('./preset-off').prepareQuickPreset(raw,layer,preset);
      if(!plan.changed)return {verified:true,layer,changed:false,keys:parseProgrammingProfile(raw).keys.map(({record,...key})=>key)};
      fs.mkdirSync(this.backupDir,{recursive:true});
      const backup=path.join(this.backupDir,`preset-${preset}-${require('node:crypto').randomUUID()}.bin`);fs.writeFileSync(backup,raw,{flag:'wx'});
      try{
        for(const command of (plan.commands||[plan.command]))device.send(command);
        const after=read();
        if(!after.equals(plan.expected)){fs.writeFileSync(backup+'.actual',after);throw new Error('Quick preset readback mismatch');}
        return {verified:true,layer,changed:true,backup,keys:parseProgrammingProfile(after).keys.map(({record,...key})=>key)};
      }catch(error){
        const errors=[];for(const command of plan.restore){try{device.send(command);}catch(e){errors.push(e.message);}}
        let restored;try{restored=read();fs.writeFileSync(backup+'.restored',restored);}catch(e){errors.push(e.message);}
        const exact=restored?.equals(raw),settings=restored?.subarray(4).equals(raw.subarray(4));
        const status=exact?'Original profile restored':settings?'Original assignments restored; profile UID differs':'Restoration could not be verified';
        throw new Error(`${error.message}. ${status}. ${errors.join('; ')} Backup: ${backup}`);
      }
    }));
  }
  setDksWasd({layer,enabled=true}) {
    return this.setDksBatch(layer,[['1:2','2:2'],['2:2','1:2'],['2:1','2:3'],['2:3','2:1']]
      .map(([id,target])=>({id,target,interval:20,enabled})));
  }
  setDksBatch(layer,requests) {
    if(![0,1].includes(layer))throw new Error('Invalid DKS profile');
    const selected=requests.map(({id,target,interval,enabled=true})=>{
      const source=layout.find(k=>k.id===id),mouseAction=typeof target==='string'&&target.startsWith('mouse:')?target.slice(6):null;
      const destination=mouseAction&&Object.hasOwn(DKS_MOUSE_ACTIONS,mouseAction)?mouseAction:layout.find(k=>k.id===target);
      if(!source||!destination)throw new Error('Select physical source and target switches');
      if(typeof enabled!=='boolean'||(enabled&&(!Number.isInteger(interval)||interval<10||interval>100)))throw new Error('Invalid DKS settings');
      return {source,destination,interval,enabled};
    });
    if(!selected.length||new Set(selected.map(k=>k.source.id)).size!==selected.length)throw new Error('Duplicate or empty DKS selection');
    return this.transaction(device=>device.withLayer('programming',layer,()=>{
      const kind=layer===0?2:4;
      const read=()=>{let error;for(let attempt=0;attempt<3;attempt++){try{return device.readInit(kind);}catch(e){error=e;}}throw error;};
      const raw=read(),before=parseProgrammingProfile(raw);
      const expected=Buffer.from(raw),steps=countMacroSteps(before.keys);
      const changes=selected.map(({source,destination,interval,enabled})=>{
        const index=source.row*COLS+source.col,key=before.keys[index],offset=8+index*68;
        if(![0,4].includes(key.mode))throw new Error('Disable the current advanced assignment first');
        if(before.keys.some(k=>[5,6].includes(k.mode)&&[k.mode===5?k.snap:k.cancel].some(t=>t.row===source.row+1&&t.col===source.col)))
          throw new Error('Disable the pair pointing to this switch first');
        let command;
        if(enabled){
          const dks=buildDksRecord(key.record.subarray(52,64),typeof destination==='string'?destination:{row:destination.row+1,col:destination.col},interval);
          expected[offset]=4;dks.copy(expected,offset+52);command=encodeDks(key,layer,steps,dks);
        }else{expected[offset]=0;command=encodeModRestore({...key,mode:0},layer,steps);}
        // Prepare restoration before any write, including validation of original data.
        const restore=encodeDksRestore(key,layer,steps);
        if(key.mode===0)restore.push(encodeModRestore(key,layer,steps));
        return {command,restore,offset,enabled,original:key.record};
      });
      fs.mkdirSync(this.backupDir,{recursive:true});
      const backup=path.join(this.backupDir,`${Date.now()}-M${layer+1}-dks.bin`);fs.writeFileSync(backup,raw,{flag:'wx'});
      try {
        for(const change of changes)device.send(change.command);
        const after=read();
        // On disable firmware may clear the now-inactive DKS payload. Verify
        // standard assignment and every other byte; retain observed inactive data.
        for(const change of changes)if(!change.enabled)after.copy(expected,change.offset+52,change.offset+52,change.offset+64);
        if(!after.subarray(0,PROFILE_SIZE).equals(expected.subarray(0,PROFILE_SIZE))){
          fs.writeFileSync(backup+'.expected',expected);fs.writeFileSync(backup+'.actual',after);
          throw new Error('DKS readback mismatch');
        }
        return {verified:true,layer,backup,keys:parseProgrammingProfile(after).keys.map(({record,...key})=>key)};
      }catch(error){
        try{
          const sendErrors=[];
          for(const change of changes){
            // Finish every restoration command, including the original mode,
            // before verification. A failed read must not strand later keys.
            for(const command of change.restore){
              try{device.send(command);}catch(e){sendErrors.push(e.message);}
            }
          }
          let restored,readError;
          for(let attempt=0;attempt<3;attempt++){
            try{restored=device.readInit(kind);break;}catch(e){readError=e;}
          }
          if(!restored)throw new Error(`Restoration could not be verified: ${readError.message}`);
          if(!restored.subarray(0,PROFILE_SIZE).equals(raw.subarray(0,PROFILE_SIZE)))
            throw new Error(`Restoration readback mismatch${sendErrors.length?': '+sendErrors.join('; '):''}`);
        }catch(restoreError){throw new Error(`${error.message}. Restoration failed: ${restoreError.message}. Backup: ${backup}`);}
        throw new Error(`${error.message}. Original assignments restored. Backup: ${backup}`);
      }
    }));
  }
  writeSelectedKeys(request) {
    if(!Array.isArray(request.ids)||!request.ids.length||request.ids.length>layout.length||new Set(request.ids).size!==request.ids.length)throw new Error('Select unique physical switches');
    if(typeof request.rtOn!=='boolean')throw new Error('Select Mechanical or RT');
    const activeFields=request.rtOn?['head','bottom','trigger','release']:['fixedDown','fixedUp'];
    const values=Object.fromEntries(activeFields.map(field=>[field,millimetresToRaw(request[field])]));
    const patches=request.ids.map(id=>{const physical=layout.find(k=>k.id===id);if(!physical)throw new Error('Unknown physical switch');return {row:physical.row,col:physical.col,rtOn:Number(request.rtOn),...values};});
    return this.applyHePatch(request.layer,patches);
  }
  writeSelectedKey(request) {
    if(request.ids?.length>1)return this.writeSelectedKeys(request);
    const physical=layout.find(k=>k.id===request.id);
    if(!physical) throw new Error('Select a key from the verified keyboard layout');
    const layer=request.layer;
    return this.transaction(device=>device.withLayer('he',layer,()=>{
      const before=device.readProfile(layer);
      const index=physical.row*COLS+physical.col;
      const desired={...before.keys[index]};
      for(const field of fields) if(request[field]!==undefined) desired[field]=millimetresToRaw(request[field]);
      if(typeof request.rtOn !== 'boolean') throw new TypeError('Rapid Trigger must be enabled or disabled');
      desired.rtOn=Number(request.rtOn);
      fs.mkdirSync(this.backupDir,{recursive:true});
      const backup=path.join(this.backupDir,`${Date.now()}-M${layer+1}-${physical.row}-${physical.col}.bin`);
      fs.writeFileSync(backup,before.raw,{flag:'wx'});
      device.writeKeyRaw(desired,layer);
      const after=device.readProfile(layer);
      for(let i=0;i<before.keys.length;i++) {
        const expected=i===index?desired:before.keys[i];
        if(JSON.stringify(after.keys[i])!==JSON.stringify(expected))
          throw new Error(`Device readback differs at ${after.keys[i].row}:${after.keys[i].col}. Backup: ${backup}`);
      }
      return {verified:true,layer,key:displayKey(after.keys[index]),backup,persistence:'Live device readback verified; power-cycle persistence not yet verified'};
    }));
  }
  applyToAll(request) {
    const physical=layout.find(k=>k.id===request.id);
    if(!physical) throw new Error('Select a key from the verified keyboard layout');
    return this.transaction(device=>device.withLayer('he',request.layer,()=>{
      const before=device.readProfile(request.layer);
      const desired={...before.keys[physical.row*COLS+physical.col]};
      for(const field of fields) desired[field]=millimetresToRaw(request[field]);
      if(typeof request.rtOn!=='boolean')throw new TypeError('Rapid Trigger must be enabled or disabled');
      desired.rtOn=Number(request.rtOn);
      fs.mkdirSync(this.backupDir,{recursive:true});
      const backup=path.join(this.backupDir,`${Date.now()}-M${request.layer+1}-all.bin`);
      fs.writeFileSync(backup,before.raw,{flag:'wx'});
      device.send(require('./he-protocol').encodeHeWrite(desired,request.layer,7));
      const after=device.readProfile(request.layer);
      if(!after.keys.every(k=>['rtOn',...fields].every(f=>k[f]===desired[f])))
        throw new Error(`Bulk write did not verify. Original profile backup: ${backup}`);
      return {verified:true,layer:request.layer,keys:after.keys.map(displayKey),layout,backup};
    }));
  }
  calibrate() { throw new Error('Calibration sequence is being recovered'); }
  restart() { throw new Error('Restart sequence is being recovered'); }
  programming() { throw new Error('Programming transport is not implemented yet'); }
  readLightingSnapshot() {
    return this.transaction(device=>{
      const directory=path.join(this.backupDir,`lighting-${require('node:crypto').randomUUID()}`);
      fs.mkdirSync(directory,{recursive:true});
      const sections=[];
      for(const kind of [6,9,17]) {
        const raw=device.readInit(kind);
        const file=path.join(directory,`init-${kind}.bin`);
        fs.writeFileSync(file,raw,{flag:'wx'});
        sections.push({kind,bytes:raw.length,hex:raw.toString('hex'),file});
      }
      const result={schema:1,device:{vendorId:0x2233,productId:0x006b},capturedAt:new Date().toISOString(),decoded:false,sections};
      fs.writeFileSync(path.join(directory,'snapshot.json'),JSON.stringify(result,null,2),{flag:'wx'});
      return {...result,backup:directory};
    });
  }
  readSingleLight() { return this.transaction(device=>require('./lighting-single').readSingleLight(device.readInit(7),device.readInit(17))); }
  setSingleLight(request) { return this.transaction(device=>require('./lighting-single').applySingleLight(device,this.backupDir,request)); }
  readBrightness() { return this.transaction(device=>{const raw=device.readInit(17);require('./lighting-brightness').encodeConfig(raw);return {brightness:raw[3]};}); }
  setBrightness(value) { return this.transaction(device=>require('./lighting-brightness').applyBrightness(device,this.backupDir,value)); }
  readBackLight() { return this.transaction(device=>{const raw=device.readInit(17);require('./lighting-brightness').encodeConfig(raw);return {...require('./lighting-backlight').readBackLight(device.readInit(6)),enabled:raw[5]===1,canEditEnabled:[0,1].includes(raw[5])};}); }
  setBackLightEnabled(value) { return this.transaction(device=>require('./lighting-brightness').applyBackLightEnabled(device,this.backupDir,value)); }
  readUnderLight() { return this.transaction(device=>{const raw=device.readInit(17);require('./lighting-brightness').encodeConfig(raw);return {...require('./lighting-underlight').readUnderLight(device.readInit(9)),brightness:raw[10],enabled:raw[9]===1,canEditEnabled:raw[9]===0||raw[9]===1,sync:raw[11],canEditSync:raw[11]===0||raw[11]===1};}); }
  setUnderLightSync(value) { return this.transaction(device=>require('./lighting-brightness').applyUnderLightSync(device,this.backupDir,value)); }
  setUnderLightEnabled(value) { return this.transaction(device=>require('./lighting-brightness').applyUnderLightEnabled(device,this.backupDir,value)); }
  setUnderLightBrightness(value) { return this.transaction(device=>require('./lighting-brightness').applyBrightness(device,this.backupDir,value,10)); }
  setUnderLightMode(mode) { return this.transaction(device=>require('./lighting-underlight').applyUnderLightMode(device,this.backupDir,mode)); }
  setUnderLightColor(request) { return this.transaction(device=>require('./lighting-underlight').applyUnderLightMode(device,this.backupDir,request?.mode,{customRgb:request?.customRgb,color:request?.color})); }
  setUnderLightSpeed(request) { return this.transaction(device=>require('./lighting-underlight').applyUnderLightMode(device,this.backupDir,request?.mode,undefined,{speed:request?.speed})); }
  setBackLightMode(mode) { return this.transaction(device=>require('./lighting-backlight').applyBackLightMode(device,this.backupDir,mode)); }
  setBackLightColor(request) { return this.transaction(device=>require('./lighting-backlight').applyBackLightMode(device,this.backupDir,request?.mode,{customRgb:request?.customRgb,color:request?.color})); }
  setBackLightSpeed(request) { return this.transaction(device=>require('./lighting-backlight').applyBackLightMode(device,this.backupDir,request?.mode,undefined,{speed:request?.speed})); }
  setBackLightDirection(request) { return this.transaction(device=>require('./lighting-backlight').applyBackLightMode(device,this.backupDir,request?.mode,undefined,undefined,{reverse:request?.reverse})); }
  lighting() { throw new Error('Lighting effect transport is not implemented yet'); }
  settings() { throw new Error('Settings transport is not implemented yet'); }
}
module.exports={HeAdapter,millimetresToRaw,displayKey};
