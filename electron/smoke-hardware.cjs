'use strict';
// Explicit hardware integration harness; not loaded by the application.
const {app,dialog}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const {HeAdapter}=require('./he-adapter');
const out=path.join(__dirname,'..','electron-smoke-result.json');
const adapter=new HeAdapter(path.join(__dirname,'..','backups','smoke'));
const result={};let original;let programmingBefore;let heOriginal;
const jsonPath=path.join(__dirname,'..','backups','smoke-he-profile.json');
dialog.showSaveDialog=async()=>({canceled:false,filePath:jsonPath});
dialog.showOpenDialog=async()=>({canceled:false,filePaths:[jsonPath]});
const {parseProgrammingProfile,encodePair,encodeModRestore,encodeDks,encodeDksRestore,countMacroSteps,PROFILE_SIZE}=require('./key-programming');
app.on('browser-window-created',(_event,win)=>{
  win.hide();
  win.webContents.on('did-finish-load',async()=>{
    const evaluate=code=>win.webContents.executeJavaScript(code);
    const ready=async()=>{
      for(let i=0;i<80;i++){
        if(await evaluate("!document.getElementById('save').disabled"))return;
        await new Promise(resolve=>setTimeout(resolve,100));
      }
      throw new Error(await evaluate("document.getElementById('status').textContent"));
    };
    try {
      await ready();
      heOriginal=adapter.exportHeProfile(0);
      fs.writeFileSync(path.join(__dirname,'..','backups',`smoke-${Date.now()}-he.json`),JSON.stringify(heOriginal));
      original=adapter.readProfile(0).keys.find(k=>k.row===2&&k.col===1);
      result.buttons=await evaluate("document.querySelectorAll('.key').length");
      if(result.buttons!==64)throw new Error('Incorrect keyboard layout');
      await evaluate(`document.getElementById('head').value=${JSON.stringify((original.head+0.002).toFixed(3))};document.getElementById('save').click();void 0`);
      await ready();
      result.status=await evaluate("document.getElementById('status').textContent");
      result.written=adapter.readProfile(0).keys.find(k=>k.row===2&&k.col===1).head;
      if(Math.abs(result.written-original.head-0.002)>1e-7)throw new Error('UI save did not reach device');
      fs.writeFileSync(path.join(__dirname,'..','electron-he-screen.png'),(await win.webContents.capturePage()).toPNG());
      programmingBefore=adapter.transaction(device=>device.readInit(2));
      fs.writeFileSync(path.join(__dirname,'..','backups',`smoke-${Date.now()}-programming.bin`),programmingBefore);
      const parsed=parseProgrammingProfile(programmingBefore);
      if([16,30,29,31,69].some(i=>parsed.keys[i].mode!==0))throw new Error('Pair smoke requires standard A/D');
      await evaluate("document.querySelectorAll('aside .nav')[3].click();void 0");
      await evaluate("document.getElementById('pair-first').value='1:2';document.getElementById('pair-second').value='2:2';document.getElementById('snap-ad').click();void 0");await ready();
      const preset=adapter.readProgramming(0);
      if(preset.keys[29].mode!==5||preset.keys[31].mode!==5||preset.keys[16].mode!==0||preset.keys[30].mode!==0)throw new Error('SNAP preset changed wrong keys');
      await evaluate("document.getElementById('snap-ad-disable').click();void 0");await ready();
      if([29,31].some(i=>adapter.readProgramming(0).keys[i].mode!==0))throw new Error('SNAP preset disable failed');
      result.snapPresetVerified=true;
      await evaluate("document.getElementById('pair-first').value='2:1';document.getElementById('pair-second').value='2:3';void 0");
      result.pairModes=[];
      for(const mode of [5,6,0]){
        await evaluate(`document.getElementById('pair-mode').value='${mode||5}';document.getElementById('${mode?'pair-apply':'pair-disable'}').click();void 0`);
        await ready();
        const state=adapter.readProgramming(0);
        if([29,31].some(i=>state.keys[i].mode!==mode))throw new Error('UI pair failed: '+await evaluate("document.getElementById('pair-status').textContent"));
        result.pairModes.push(mode);
      }
      await evaluate("document.getElementById('dks-target').value='2:3';document.getElementById('dks-interval').value='20';document.getElementById('dks-apply').click();void 0");
      await ready();
      const dksKey=adapter.readProgramming(0).keys[29];
      if(dksKey.mode!==4||dksKey.dks.col!==3||dksKey.dks.row!==3||dksKey.dks.interval!==20)throw new Error('UI DKS failed');
      await evaluate("document.getElementById('dks-disable').click();void 0");await ready();
      if(adapter.readProgramming(0).keys[29].mode!==0)throw new Error('UI DKS disable failed');
      result.dksVerified=true;
      await evaluate("document.getElementById('dks-wasd').click();void 0");await ready();
      const wasd=adapter.readProgramming(0);
      if([16,30,29,31].some(i=>wasd.keys[i].mode!==4))throw new Error('UI WASD failed');
      await evaluate("document.getElementById('dks-wasd-disable').click();void 0");await ready();
      if([16,30,29,31].some(i=>adapter.readProgramming(0).keys[i].mode!==0))throw new Error('UI WASD disable failed');
      result.wasdVerified=true;
      await evaluate("document.getElementById('dks-source').value='4:13';document.getElementById('dks-source').dispatchEvent(new Event('change'));document.getElementById('dks-target').value='mouse:wheel-down';document.getElementById('dks-interval').value='20';document.getElementById('dks-apply').click();void 0");await ready();
      if(adapter.readProgramming(0).keys[69].dks.mouseAction!=='wheel-down')throw new Error('UI mouse DKS failed');
      await evaluate("document.getElementById('dks-disable').click();void 0");await ready();
      if(adapter.readProgramming(0).keys[69].mode!==0)throw new Error('UI mouse DKS disable failed');
      result.mouseDksVerified=true;
      await evaluate("document.querySelectorAll('aside .nav')[0].click();document.getElementById('export-he').click();void 0");await ready();
      const exported=JSON.parse(fs.readFileSync(jsonPath,'utf8'));
      if(exported.keys.length!==64)throw new Error('UI JSON export failed');
      const sKey=exported.keys.find(k=>k.id==='2:2');sKey.head=Number((sKey.head+0.002).toFixed(3));
      fs.writeFileSync(jsonPath,JSON.stringify(exported));
      await evaluate("document.getElementById('import-he').click();void 0");await ready();
      if(adapter.readProfile(0).keys.find(k=>k.row===2&&k.col===2).head!==sKey.head)throw new Error('UI JSON import failed');
      result.jsonVerified=true;
      fs.writeFileSync(path.join(__dirname,'..','electron-advanced-screen.png'),(await win.webContents.capturePage()).toPNG());
      result.ok=true;
    } catch(error) {result.error=error.stack;result.ok=false;}
    finally {
      try {
        if(programmingBefore)adapter.transaction(device=>device.withLayer('programming',0,()=>{
          const parsed=parseProgrammingProfile(programmingBefore),steps=countMacroSteps(parsed.keys);
          for(const index of [16,30,29,31,69]){
            const key=parsed.keys[index];
            if(key.mode!==0)throw new Error('Cannot restore nonstandard smoke input');
            if([29,31].includes(index)){device.send(encodePair(key,0,steps,5,key.snap));device.send(encodePair(key,0,steps,6,key.cancel));device.readInit(2);}
            for(const command of encodeDksRestore(key,0,steps))device.send(command);
            device.send(encodeModRestore(key,0,steps));
            if(!device.readInit(2).subarray(8+index*68,8+(index+1)*68).equals(key.record))throw new Error(`Restore failed at ${index}`);
          }
          result.pairRestored=device.readInit(2).subarray(0,PROFILE_SIZE).equals(programmingBefore.subarray(0,PROFILE_SIZE));
          if(!result.pairRestored)throw new Error('Pair restoration mismatch');
        }));
      }catch(error){result.restoreError=error.stack;result.ok=false;}
      try{
        if(heOriginal)adapter.importHeProfile(0,heOriginal);
        if(original){adapter.writeSelectedKey({...original,id:'2:1',layer:0});result.restored=true;}
      }catch(error){result.restored=false;result.heRestoreError=error.stack;result.ok=false;}
      fs.writeFileSync(out,JSON.stringify(result,null,2));app.exit(result.ok?0:1);
    }
  });
});
require('./main');
