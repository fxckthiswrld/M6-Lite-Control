'use strict';
// Observe the packaged UI. Calibration commands are issued only by the user.
const {app}=require('electron');
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const application=path.join(root,'dist',`M6-Lite-Control-${require('./package.json').version}-win32-x64`,'resources','app');
const output=path.join(root,'calibration-live-observation.json');
const report={startedAt:new Date().toISOString(),application,observerCommands:['navigate','read'],samples:[],done:false};
const save=()=>fs.writeFileSync(output,JSON.stringify(report,null,2));
app.on('browser-window-created',(_event,win)=>{
 win.webContents.once('did-finish-load',async()=>{
  try{
   const evaluate=code=>win.webContents.executeJavaScript(code);
   for(let i=0;i<100;i++){
    if(await evaluate('typeof busy!=="undefined"&&!busy&&!!profile'))break;
    await new Promise(resolve=>setTimeout(resolve,100));
   }
   await evaluate('navigateUI("calibration");void 0');
   await evaluate('refreshCalibration();void 0');
   let pending=false,seenActive=false,inactiveSince=null,last='',baseline=null;
   const deadline=Date.now()+300000;
   const timer=setInterval(async()=>{
    if(pending)return;pending=true;
    try{
     const sample=await evaluate(`({active:calibrationActive,busy,read:document.getElementById('calibration-read-status').textContent,status:document.getElementById('calibration-status').textContent,keys:Array.from(document.querySelectorAll('.calibration-key'),key=>({id:key.dataset.id,label:key.children[0].textContent,range:key.children[2].textContent}))})`);
     if(!baseline&&sample.keys.length===64&&!sample.active)baseline=sample.keys;
     sample.changedFromBaseline=baseline?sample.keys.filter(key=>baseline.find(old=>old.id===key.id)?.range!==key.range).map(key=>key.id):null;
     if(sample.active){seenActive=true;inactiveSince=null;}else if(seenActive&&!inactiveSince)inactiveSince=Date.now();
     const signature=JSON.stringify(sample);
     if(signature!==last){last=signature;report.samples.push({observedAt:new Date().toISOString(),...sample});save();}
     if((inactiveSince&&Date.now()-inactiveSince>4000&&!sample.busy)||Date.now()>deadline){
      clearInterval(timer);report.done=true;report.reason=inactiveSince?'session-ended':'observation-time-limit';report.finishedAt=new Date().toISOString();save();
     }
    }catch(error){clearInterval(timer);report.error=error.stack;report.done=true;save();}
    finally{pending=false;}
   },500);
   save();console.log('Calibration observation ready: '+output);
  }catch(error){report.error=error.stack;report.done=true;save();}
 });
});
require(path.join(application,'main.js'));
