'use strict';
const {app}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {HeAdapter}=require('./he-adapter');
const adapter=new HeAdapter(path.join(__dirname,'..','backups','smoke'));
app.on('browser-window-created',(_event,win)=>{
 win.hide();win.webContents.on('did-finish-load',async()=>{
  const evaluate=code=>win.webContents.executeJavaScript(code),result={};
  const ready=async()=>{for(let i=0;i<100;i++){if(await evaluate("!document.getElementById('save').disabled"))return;await new Promise(r=>setTimeout(r,100));}throw new Error('UI not ready');};
  try{
   await ready();const before=adapter.readCalibration(),profiles=[adapter.exportHeProfile(0),adapter.exportHeProfile(1)];
   await evaluate("document.getElementById('head').value='2.000';Array.from(document.querySelectorAll('aside .nav')).find(n=>n.textContent==='Calibration').click();document.getElementById('calibration-read').click();void 0");await ready();
   const state=await evaluate("({count:document.querySelectorAll('.calibration-key').length,status:document.getElementById('calibration-status').textContent,visible:!document.getElementById('calibration-read').closest('section').hidden})");
   assert.equal(state.count,64);assert.equal(state.visible,true);assert.match(state.status,/Backup:/);
   const firstRead=await evaluate("document.getElementById('calibration-read-status').textContent");
   assert.match(firstRead,/Updated: .*Successful reads: 1/);
   await evaluate("document.getElementById('calibration-read').click();void 0");await ready();
   const secondRead=await evaluate("document.getElementById('calibration-read-status').textContent");
   assert.match(secondRead,/Updated: .*Successful reads: 2.*previous read: 0\/64/);
   const after=adapter.readCalibration();assert.deepEqual(fs.readFileSync(after.backup),fs.readFileSync(before.backup));
   for(const layer of [0,1])assert.deepEqual(adapter.exportHeProfile(layer),profiles[layer]);
   await evaluate("document.querySelectorAll('aside .nav')[0].click();void 0");
   assert.equal(await evaluate("document.getElementById('calibration-read').closest('section').hidden"),true);
   Object.assign(result,{ok:true,markers:64,calibrationUnchanged:true,heProfilesUnchanged:true,navigationVerified:true,firstRead,secondRead,physicalPressTested:false});
  }catch(error){result.ok=false;result.error=error.stack;}
  finally{fs.writeFileSync(path.join(__dirname,'..','electron-calibration-result.json'),JSON.stringify(result,null,2));console.log(result);app.exit(result.ok?0:1);}
 });
});
require('./main');
