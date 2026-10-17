'use strict';
// Packaged renderer -> IPC -> real keyboard. Restore exact A/S records in finally.
const {app}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const application=process.env.M6_SINGLE_APP?path.resolve(process.env.M6_SINGLE_APP):__dirname;
const {HeAdapter}=require(path.join(application,'he-adapter')),{encodeSingle}=require(path.join(application,'lighting-single'));
const backup=path.resolve(__dirname,'../backups/single-rgb-brightness-'+randomUUID());fs.mkdirSync(backup,{recursive:true});
app.setPath('userData',path.join(backup,'app-data'));
const adapter=new HeAdapter(backup),kinds=[1,2,4,24,25,26,6,7,9,17],before=new Map();
const report={application,backup,checks:[],comparison:'All ten sections; INIT6 known first 218 bytes',persistenceTested:false};
let touched=false;
app.on('browser-window-created',(_event,win)=>{
 win.webContents.once('did-finish-load',async()=>{
  const evaluate=code=>win.webContents.executeJavaScript(code);
  const ready=async()=>{for(let i=0;i<250;i++){if(await evaluate('window.m6UI && !window.m6UI.snapshot().busy && window.m6UI.snapshot().connected'))return;await new Promise(r=>setTimeout(r,100));}throw Error('UI not ready');};
  const click=async id=>{assert.equal(await evaluate(`document.getElementById('${id}').disabled`),false);await evaluate(`document.getElementById('${id}').click();void 0`);await ready();};
  const select=async ids=>evaluate(`for(const o of document.getElementById('single-keys').options)o.selected=${JSON.stringify(ids)}.includes(o.value);document.getElementById('single-keys').dispatchEvent(new Event('change'));void 0`);
  function verify(expected,label){adapter.transaction(d=>{
   for(const k of kinds){const actual=d.readInit(k),target=k===7?expected:before.get(k),n=k===6?218:target.length;fs.writeFileSync(path.join(backup,`${label}-${k}.bin`),actual);assert.equal(actual.length,target.length);assert.ok(actual.subarray(0,n).equals(target.subarray(0,n)),`${label}: INIT${k}`);}
  });}
  try{
   await ready();adapter.transaction(d=>{for(const k of kinds){const raw=d.readInit(k);before.set(k,raw);fs.writeFileSync(path.join(backup,`init-${k}.bin`),raw);}});
   for(const o of [80,140]){assert.ok([0,1].includes(before.get(7)[o]));assert.equal(before.get(7)[o+1],1);}
   await evaluate("window.m6UI.navigate('lighting');void 0");await ready();await evaluate("document.querySelector('[data-key=single]').click();void 0");
   assert.equal(await evaluate("document.getElementById('single-mode')===null"),true);
   const expected=Buffer.from(before.get(7));
   for(const [id,o,color] of [['2:1',80,'#2468ac'],['2:2',140,'#713da5']]){
    await select([id]);await evaluate(`document.getElementById('single-color').value='${color}';document.getElementById('single-enabled').checked=true;void 0`);
    touched=true;await click('single-apply');assert.match(await evaluate("document.getElementById('single-status').textContent"),/applied; device readback verified/);
    expected[o]=1;Buffer.from(color.slice(1),'hex').copy(expected,o+3);verify(expected,'color-'+o);
   }
   report.checks.push('Individual A/S RGB edits preserve original per-key brightness');
   await select(['2:1','2:2']);
   for(const percent of [0,50,100]){
    await evaluate(`document.getElementById('single-brightness').value='${percent}';document.getElementById('single-brightness').dispatchEvent(new Event('input'));void 0`);
    await click('single-brightness-apply');assert.match(await evaluate("document.getElementById('single-status').textContent"),/applied; device readback verified/);
    const raw=Math.round(percent*255/100);expected[82]=raw;expected[142]=raw;verify(expected,'brightness-'+percent);
    assert.equal(await evaluate("document.getElementById('single-brightness-value').value"),percent+'%');
    report.checks.push(`A/S brightness ${percent}% (${raw}/255) preserves distinct RGB and flags`);
   }
   // A value not exactly representable as integer percent must survive RGB-only Apply.
   adapter.setSingleLight({keys:['2:1'],brightness:73});expected[82]=73;
   await click('single-read');await select(['2:1']);
   await evaluate("document.getElementById('single-color').value='#123456';void 0");await click('single-apply');expected.set([18,52,86],83);verify(expected,'rgb-preserves-73');
   await click('single-brightness-apply');verify(expected,'brightness-unmoved-preserves-73');
   report.checks.push('RGB-only Apply and untouched brightness slider preserve exact 73/255');
   await evaluate("document.getElementById('single-brightness').value='99';document.getElementById('single-brightness').dispatchEvent(new Event('input'));document.getElementById('single-color').value='#abcdef';void 0");
   await click('single-read');assert.equal(await evaluate("document.getElementById('single-brightness').value"),'29');assert.equal(await evaluate("document.getElementById('single-color').value"),'#123456');
   await evaluate("document.getElementById('single-brightness').value='2';document.getElementById('single-brightness').dispatchEvent(new Event('input'));window.m6UI.navigate('home');void 0");
   assert.equal(await evaluate("document.getElementById('single-brightness').value"),'29');verify(expected,'drafts-discarded');report.checks.push('Refresh and navigation discard drafts without writes');
   await evaluate("window.m6UI.navigate('lighting');void 0");await ready();await evaluate("document.querySelector('[data-key=single]').click();void 0");
   fs.writeFileSync(path.join(backup,'single-rgb-brightness-ui.png'),(await win.webContents.capturePage()).toPNG());report.ok=true;
  }catch(error){report.ok=false;report.error=error.stack;}
  finally{
   try{if(touched)adapter.transaction(d=>{for(const key of [{col:1,row:2},{col:2,row:2}])d.send(encodeSingle(before.get(7),key));});if(before.size===kinds.length){verify(before.get(7),'restored');report.restored=true;}}
   catch(error){report.ok=false;report.restoreError=error.stack;}
   fs.writeFileSync(path.resolve(__dirname,'../lighting-single-rgb-brightness-verification.json'),JSON.stringify(report,null,2));console.log(report);app.exit(report.ok?0:1);
  }
 });
});
require(path.join(application,'main'));
