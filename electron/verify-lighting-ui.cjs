'use strict';
// Controlled hardware verification: changes A/S and layer flags, then restores
// exact raw records in finally. Never sends Save to device memory.
const {app}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {HeAdapter}=require('./he-adapter'),{encodeSingle}=require('./lighting-single'),{encodeConfig}=require('./lighting-brightness');
app.setPath('userData',path.join(app.getPath('temp'),'m6-lighting-write-check'));
const backup=path.resolve(__dirname,'../backups/lighting-ui-'+randomUUID()),adapter=new HeAdapter(backup),before=new Map(),kinds=[1,2,4,24,25,26,6,7,9,17];
fs.mkdirSync(backup,{recursive:true});
adapter.transaction(d=>{for(const k of kinds){const raw=d.readInit(k);before.set(k,raw);fs.writeFileSync(path.join(backup,`init-${k}.bin`),raw);}});
app.on('browser-window-created',(_event,win)=>{
 win.hide();win.webContents.once('did-finish-load',async()=>{
  const result={backup,checks:[]},evaluate=code=>win.webContents.executeJavaScript(code);
  const ready=async()=>{for(let i=0;i<200;i++){if(await evaluate("!document.getElementById('save').disabled"))return;await new Promise(r=>setTimeout(r,100));}throw Error('UI not ready');};
  const click=async id=>{assert.equal(await evaluate(`document.getElementById('${id}').disabled`),false);await evaluate(`document.getElementById('${id}').click();void 0`);await ready();};
  try{
   await ready();await evaluate("document.querySelectorAll('aside .nav')[5].click();void 0");await ready();
   await evaluate("for(const o of document.getElementById('single-keys').options)o.selected=['2:1','2:2'].includes(o.value);document.getElementById('single-keys').dispatchEvent(new Event('change'));document.getElementById('single-enabled').checked=true;document.getElementById('single-color').value='#2468ac';void 0");
   await click('single-apply');assert.match(await evaluate("document.getElementById('single-status').textContent"),/applied/);
   const single=adapter.readSingleLight();for(const id of ['2:1','2:2']){const k=single.keys.find(k=>k.id===id);assert.equal(k.enabled,true);assert.equal(k.color,'#2468AC');}result.checks.push('A/S group color through renderer, preload, IPC and HID');
   for(const [field,button,offset,readback] of [['backlight-enabled','backlight-enabled-apply',5,()=>adapter.readBackLight().enabled],['single-active','single-active-apply',6,()=>adapter.readSingleLight().enabled],['underlight-enabled','underlight-enabled-apply',9,()=>adapter.readUnderLight().enabled],['underlight-sync','underlight-sync-apply',11,()=>!!adapter.readUnderLight().sync]]){
    const original=before.get(17)[offset]===1;
    for(const value of [!original,original]){await evaluate(`document.getElementById('${field}').checked=${value};void 0`);await click(button);assert.equal(readback(),value);}
    result.checks.push(field+' toggled and restored through UI');
   }
   result.ok=true;
  }catch(error){result.ok=false;result.error=error.stack;}
  finally{
   try{adapter.transaction(d=>{
    for(const key of [{col:1,row:2},{col:2,row:2}])d.send(encodeSingle(before.get(7),key));
    d.send(encodeConfig(before.get(17)));
    for(const k of kinds){const actual=d.readInit(k),target=before.get(k),n=k===6?218:target.length;fs.writeFileSync(path.join(backup,`restored-${k}.bin`),actual);assert.equal(actual.length,target.length);assert.ok(actual.subarray(0,n).equals(target.subarray(0,n)),`Restoration mismatch INIT${k}`);}
   });result.restored=true;}catch(error){result.ok=false;result.restoreError=error.stack;}
   fs.writeFileSync(path.resolve(__dirname,'../lighting-ui-write-verification.json'),JSON.stringify(result,null,2));console.log(result);app.exit(result.ok?0:1);
  }
 });
});
require('./main');
