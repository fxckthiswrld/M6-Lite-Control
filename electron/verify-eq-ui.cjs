'use strict';
const {app}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
app.setPath('userData',path.join(app.getPath('temp'),'m6-eq-ui-check'));
const report={};let win;
const timeout=setTimeout(()=>{console.error('EQ UI timeout');app.quit();},45000);
app.on('browser-window-created',(_event,created)=>{
 win=created;win.webContents.once('did-finish-load',async()=>{
  const run=code=>win.webContents.executeJavaScript(code);
  try{
   for(let i=0;i<100;i++){if(await run('!busy && !!profile'))break;await new Promise(r=>setTimeout(r,100));}
   await run('lightingBrightness()');
   report.before=await run('Number(document.getElementById("lighting-mode").value)');
   assert.ok(report.before>=2&&report.before<=7);
   await run('document.getElementById("lighting-mode").value="1";document.getElementById("lighting-mode-apply").onclick()');
   assert.equal(await run('eqLighting.isActive()'),true);
   report.interlock=await run('window.keyboard.saveToDeviceMemory ? window.keyboard.saveToDeviceMemory() : window.keyboard.setBrightness(123)');
   assert.equal(report.interlock.ok,false);
   win.close();assert.equal(win.isVisible(),false);assert.equal(win.isDestroyed(),false);
   await new Promise(r=>setTimeout(r,1800));
   report.capture=await run('eqLighting.isActive()');assert.equal(report.capture,true);
   report.restoration=await run('eqLighting.stop()');assert.equal(report.restoration.ok,true);assert.ok(report.restoration.result.sent>0);
   report.savedPreference=await run('window.keyboard.eqPreference()');assert.equal(report.savedPreference.result.resume,true);
   await run('eqLighting.resume()');assert.equal(await run('eqLighting.isActive()'),true);
   await new Promise(r=>setTimeout(r,500));
   await run(`document.getElementById('lighting-mode').value='${report.before}';document.getElementById('lighting-mode-apply').onclick()`);
   report.after=await run('window.keyboard.readBackLight()');assert.equal(report.after.result.mode,report.before);
   report.disabledPreference=await run('window.keyboard.eqPreference()');assert.equal(report.disabledPreference.result.resume,false);
   report.ok=true;
  }catch(error){report.ok=false;report.error=error.stack;}
  finally{
   try{report.cleanup=await run('eqLighting.stop()');}catch(error){report.cleanupError=error.message;}
   clearTimeout(timeout);fs.writeFileSync(path.join(__dirname,'../lighting-eq-ui-verification.json'),JSON.stringify(report,null,2));console.log(report);app.quit();
  }
 });
});
require('./main');
