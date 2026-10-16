'use strict';
const {app}=require('electron');
const fs=require('node:fs'),path=require('node:path');
const {HeAdapter}=require('./he-adapter');
const adapter=new HeAdapter(path.join(__dirname,'..','backups','smoke'));
const result={};let original;
app.on('browser-window-created',(_event,win)=>{
  win.hide();win.setSize(1280,1100);
  win.webContents.on('did-finish-load',async()=>{
    const evaluate=code=>win.webContents.executeJavaScript(code);
    const ready=async()=>{for(let i=0;i<100;i++){if(await evaluate("!document.getElementById('save').disabled"))return;await new Promise(resolve=>setTimeout(resolve,100));}throw new Error('UI not ready');};
    const checkLabels=async()=>{
      const state=adapter.readProfile(0);
      const labels=await evaluate("[...document.querySelectorAll('.key')].map(b=>({id:b.dataset.id,release:b.querySelector('.key-release').textContent,trigger:b.querySelector('.key-trigger').textContent,top:b.querySelector('.key-release').getBoundingClientRect().top,bottom:b.querySelector('.key-trigger').getBoundingClientRect().top}))");
      if(labels.length!==64)throw new Error('Expected 64 switch labels');
      for(const label of labels){const key=state.keys.find(k=>`${k.row}:${k.col}`===label.id);
        if(label.trigger!==(key.rtOn?key.trigger:key.fixedDown).toFixed(3)||label.release!==(key.rtOn?key.release:key.fixedUp).toFixed(3)||label.top>=label.bottom)throw new Error('Incorrect key annotation: '+label.id);
      }
      const selected=labels.find(k=>k.id==='2:1');
      if(await evaluate("document.getElementById('selected-release').textContent")!==selected.release||await evaluate("document.getElementById('selected-trigger').textContent")!==selected.trigger)throw new Error('Selected annotation mismatch');
    };
    try{
      await ready();original=adapter.exportHeProfile(0);
      fs.writeFileSync(path.join(__dirname,'..','backups',`actuation-${Date.now()}.json`),JSON.stringify(original));
      await checkLabels();
      const before=adapter.readProfile(0).keys.find(k=>k.row===2&&k.col===1);
      await evaluate("document.getElementById('mode-mechanical').click();document.getElementById('save').click();void 0");await ready();
      if(adapter.readProfile(0).keys[29].rtOn)throw new Error('Mechanical mode not written');
      const value=Number((before.fixedDown+(before.fixedDown<3.3?0.002:-0.002)).toFixed(3));
      await evaluate(`document.getElementById('fixedDown').value=${value};document.getElementById('fixedDown').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter'}));void 0`);await ready();
      if(adapter.readProfile(0).keys[29].fixedDown!==before.fixedDown)throw new Error('Draft applied before Apply click');
      await evaluate("document.getElementById('fixedDown').dispatchEvent(new Event('change'));void 0");
      if(adapter.readProfile(0).keys[29].fixedDown!==before.fixedDown)throw new Error('Field exit applied draft');
      await evaluate("document.getElementById('save').click();void 0");await ready();
      result.explicitApplyVerified=true;
      const mechanical=adapter.readProfile(0).keys[29];
      if(mechanical.fixedDown!==value||['head','bottom','trigger','release'].some(f=>mechanical[f]!==before[f]))throw new Error('Mechanical write changed RT data');
      if(await evaluate("document.getElementById('mechanical-fields').hidden || !document.getElementById('rt-fields').hidden"))throw new Error('Wrong Mechanical fields visible');
      await checkLabels();result.mechanicalVerified=true;
      fs.writeFileSync(path.join(__dirname,'..','electron-mechanical-screen.png'),(await win.webContents.capturePage()).toPNG());
      await evaluate("document.getElementById('mode-rt').click();document.getElementById('save').click();void 0");await ready();
      if(!adapter.readProfile(0).keys[29].rtOn)throw new Error('RT mode not written');
      if(await evaluate("!document.getElementById('mechanical-fields').hidden || document.getElementById('rt-fields').hidden"))throw new Error('Wrong RT fields visible');
      await checkLabels();result.rtVerified=true;
      result.colors=await evaluate("({release:getComputedStyle(document.querySelector('.key.chosen .key-release')).color,trigger:getComputedStyle(document.querySelector('.key.chosen .key-trigger')).color})");
      fs.writeFileSync(path.join(__dirname,'..','electron-rt-screen.png'),(await win.webContents.capturePage()).toPNG());result.ok=true;
    }catch(error){result.ok=false;result.error=error.stack;}
    finally{
      if(original)try{adapter.importHeProfile(0,original);result.restored=JSON.stringify(adapter.exportHeProfile(0))===JSON.stringify(original);if(!result.restored)result.ok=false;}catch(error){result.ok=false;result.restoreError=error.stack;}
      fs.writeFileSync(path.join(__dirname,'..','electron-actuation-result.json'),JSON.stringify(result,null,2));app.exit(result.ok?0:1);
    }
  });
});
require('./main');
