'use strict';
// Packaged renderer -> IPC -> device. Always restore the two touched config blocks.
// M6_SETTINGS_READ_ONLY=1 checks visible UI/drafts without applying device settings.
const {app}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const application=path.resolve(process.env.M6_SETTINGS_APP||__dirname),readOnly=process.env.M6_SETTINGS_READ_ONLY==='1';
const {HeAdapter}=require(path.join(application,'he-adapter'));
const backup=path.resolve(__dirname,'../backups/settings-parity-'+randomUUID());fs.mkdirSync(backup,{recursive:true});
app.setPath('userData',path.join(backup,'app-data'));
const adapter=new HeAdapter(backup),kinds=[1,2,4,24,25,26,6,7,9,17],before={},expected={},touched=new Set();
const report={application,readOnly,backup,checks:[],comparison:'All ten sections; INIT6 first 218 known bytes',persistenceTested:false};
app.on('browser-window-created',(_event,win)=>win.webContents.once('did-finish-load',async()=>{
 const evaluate=code=>win.webContents.executeJavaScript(code),pause=ms=>new Promise(r=>setTimeout(r,ms));
 const ready=async()=>{for(let i=0;i<250;i++){if(await evaluate('window.m6UI?.snapshot().connected && !window.m6UI.snapshot().busy'))return;await pause(100);}throw Error('UI not ready');};
 const click=async id=>{assert.equal(await evaluate(`document.getElementById('${id}').disabled`),false,id);await evaluate(`document.getElementById('${id}').click();void 0`);await ready();};
 const edit=async(id,value,property='value')=>evaluate(`(()=>{const el=document.getElementById(${JSON.stringify(id)});el[${JSON.stringify(property)}]=${JSON.stringify(value)};el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 function verify(want,label){adapter.transaction(d=>{for(const k of kinds){const actual=d.readInit(k),n=k===6?218:want[k].length;fs.writeFileSync(path.join(backup,`${label}-${k}.bin`),actual);assert.equal(actual.length,want[k].length);assert.ok(actual.subarray(0,n).equals(want[k].subarray(0,n)),`${label}: INIT${k}`);}});}
 async function apply(id,kind,patch,label){
  touched.add(kind);await click(id);
  assert.match(await evaluate("document.getElementById('device-settings-status').textContent"),/applied.*verified/);
  for(const [offset,value] of Object.entries(patch))expected[kind][offset]=value;
  verify(expected,label);report.checks.push(label);
 }
 try{
  win.show();win.focus();await ready();
  adapter.transaction(d=>{for(const k of kinds){before[k]=d.readInit(k);expected[k]=Buffer.from(before[k]);fs.writeFileSync(path.join(backup,`before-${k}.bin`),before[k]);}});
  await evaluate("window.m6UI.navigate('settings');void 0");await ready();
  assert.match(await evaluate("document.getElementById('device-settings-status').textContent"),/read from keyboard/);
  for(const id of ['highlight','auto-calibration','auto-light-off','saturation'])assert.equal(await evaluate(`document.getElementById('device-${id}-apply').disabled`),false);
  for(const [id,raw] of [['highlight',before[17][4]],['auto-calibration',before[1][13]],['auto-light-off',before[1][8]]])assert.equal(await evaluate(`document.getElementById('device-${id}').checked`),raw===1);
  for(const i of [0,1,2])assert.equal(await evaluate(`Number(document.getElementById('device-saturation-${i}').value)`),before[17][i]);
  report.checks.push('All four controls read device values and allow editing');
  await edit('device-highlight',before[17][4]!==1,'checked');await edit('device-auto-calibration',before[1][13]!==1,'checked');
  await edit('device-auto-light-off',true,'checked');await edit('device-auto-light-off-minutes',String(before[1][9]===30?1:30));
  for(const i of [0,1,2])await edit('device-saturation-'+i,String(before[17][i]===64?255:64));
  verify(before,'draft-only');await click('device-settings-read');
  assert.equal(await evaluate("document.getElementById('device-highlight').checked"),before[17][4]===1);
  assert.equal(await evaluate("document.getElementById('device-auto-calibration').checked"),before[1][13]===1);
  for(const i of [0,1,2])assert.equal(await evaluate(`Number(document.getElementById('device-saturation-${i}').value)`),before[17][i]);
  await edit('device-highlight',before[17][4]!==1,'checked');await edit('device-saturation-0',String(before[17][0]===64?255:64));
  await evaluate("window.m6UI.navigate('home');void 0");
  assert.equal(await evaluate("document.getElementById('device-highlight').checked"),before[17][4]===1);
  assert.equal(await evaluate("Number(document.getElementById('device-saturation-0').value)"),before[17][0]);
  await evaluate("window.m6UI.navigate('settings');void 0");await ready();verify(before,'drafts-discarded');
  report.checks.push('Editing sends no writes; Refresh and navigation discard drafts');
  if(!readOnly){
   for(const enabled of [!Boolean(before[17][4]),Boolean(before[17][4])]){
    await edit('device-highlight',enabled,'checked');
    await apply('device-highlight-apply',17,{4:Number(enabled)},'highlight-'+enabled);
   }
   for(const enabled of [!Boolean(before[1][13]),Boolean(before[1][13])]){
    await edit('device-auto-calibration',enabled,'checked');
    await apply('device-auto-calibration-apply',1,{13:Number(enabled)},'auto-calibration-'+enabled);
   }
   for(const minutes of [1,30]){
    await edit('device-auto-light-off',true,'checked');await edit('device-auto-light-off-minutes',String(minutes));
    await apply('device-auto-light-off-apply',1,{8:1,9:minutes},'auto-light-off-'+minutes+'min');
   }
   await edit('device-auto-light-off',false,'checked');
   assert.equal(await evaluate("document.getElementById('device-auto-light-off-minutes').disabled"),true);
   await apply('device-auto-light-off-apply',1,{8:0},'auto-light-off-disabled-preserves-delay');
   for(const rgb of [[64,128,255],[255,64,128],[128,255,64]]){
    for(const i of [0,1,2])await edit('device-saturation-'+i,String(rgb[i]));
    await apply('device-saturation-apply',17,Object.fromEntries(rgb.map((v,i)=>[i,v])),'saturation-'+rgb.join('-'));
   }
  }
  await evaluate("document.querySelector('[data-setting=highlight]').scrollIntoView({block:'start'});void 0");await pause(200);
  fs.writeFileSync(path.join(backup,'settings-controls.png'),(await win.webContents.capturePage()).toPNG());report.ok=true;
 }catch(error){report.ok=false;report.error=error.stack;fs.writeFileSync(path.join(backup,'failed-ui.png'),(await win.webContents.capturePage()).toPNG());}
 finally{
  try{
   for(const k of [17,1])if(touched.has(k)){
    const payload=Buffer.alloc(20);payload.set([8,k===1?2:17]);before[k].copy(payload,2,0,k===1?14:18);
    try{adapter.transaction(d=>d.send(payload));}catch(error){report.restoreDispatchError=error.message;}
    await pause(300);
   }
   if(Object.keys(before).length===kinds.length){
    for(let attempt=0;attempt<10;attempt++){try{verify(before,'restored');report.restored=true;break;}catch(error){if(attempt===9)throw error;await pause(300);}}
   }
  }catch(error){report.ok=false;report.restoreError=error.stack;}
  fs.writeFileSync(path.resolve(__dirname,'../settings-parity-'+(readOnly?'ui':'hardware')+'-verification.json'),JSON.stringify(report,null,2));console.log(report);app.exit(report.ok?0:1);
 }
}));
require(path.join(application,'main'));
