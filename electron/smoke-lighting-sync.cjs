'use strict';
const {app}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
app.setPath('userData',path.join(app.getPath('temp'),'m6-lighting-sync-smoke'));
const timer=setTimeout(()=>app.exit(1),60000);
app.on('browser-window-created',(_event,win)=>{
 win.hide();win.webContents.once('did-finish-load',async()=>{
  const evaluate=code=>win.webContents.executeJavaScript(code),result={};
  const ready=async()=>{for(let i=0;i<150;i++){if(await evaluate("!document.getElementById('save').disabled"))return;await new Promise(r=>setTimeout(r,100));}throw Error('UI not ready');};
  try{
   await ready();await evaluate("document.querySelectorAll('aside .nav')[5].click();void 0");await ready();
   assert.equal(await evaluate("document.getElementById('underlight-sync').checked"),true);
   for(const id of ['underlight-mode','underlight-apply','underlight-color-apply','underlight-speed-apply'])assert.equal(await evaluate(`document.getElementById('${id}').disabled`),true);
   for(const id of ['underlight-sync-apply','underlight-enabled-apply','underlight-brightness-apply'])assert.equal(await evaluate(`document.getElementById('${id}').disabled`),false);
   await evaluate("document.getElementById('underlight-sync').checked=false;document.getElementById('underlight-read').click();void 0");await ready();
   assert.equal(await evaluate("document.getElementById('underlight-sync').checked"),true);
   result.ok=true;result.independentEffectsLocked=true;result.syncDraftDiscarded=true;result.deviceWrites=false;
  }catch(error){result.ok=false;result.error=error.stack;}
  finally{clearTimeout(timer);fs.writeFileSync(path.join(__dirname,'..','electron-lighting-sync-result.json'),JSON.stringify(result,null,2));console.log(result);app.exit(result.ok?0:1);}
 });
});
require('./main');
