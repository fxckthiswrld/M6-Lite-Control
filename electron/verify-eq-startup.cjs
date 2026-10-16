'use strict';
const {app}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const directory=path.join(app.getPath('temp'),'m6-eq-startup-check');app.setPath('userData',directory);
new (require('./eq-preference').EqPreference)(directory).write(true);
process.argv.push('--background');
const report={};const timeout=setTimeout(()=>{console.error('Startup verification timed out');app.quit();},45000);
app.on('browser-window-created',(_event,win)=>{
 win.webContents.once('did-finish-load',async()=>{
  const run=code=>win.webContents.executeJavaScript(code);
  try{
   for(let i=0;i<200;i++){if(await run('eqLighting.isActive()'))break;await new Promise(r=>setTimeout(r,100));}
   assert.equal(await run('eqLighting.isActive()'),true);assert.equal(win.isVisible(),false);
   await new Promise(r=>setTimeout(r,1600));
   report.restoration=await run('eqLighting.stop()');assert.equal(report.restoration.ok,true);assert.ok(report.restoration.result.sent>0);
   report.preference=await run('window.keyboard.eqPreference()');assert.equal(report.preference.result.resume,true);
   report.ok=true;
  }catch(error){report.ok=false;report.error=error.stack;}
  finally{
   try{report.cleanup=await run('eqLighting.stop(true)');}catch(error){report.cleanupError=error.message;}
   clearTimeout(timeout);fs.writeFileSync(path.join(__dirname,'../lighting-eq-startup-verification.json'),JSON.stringify(report,null,2));console.log(report);app.quit();
  }
 });
});
require('./main');
