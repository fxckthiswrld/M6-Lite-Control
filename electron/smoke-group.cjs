'use strict';
const {app}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {HeAdapter}=require('./he-adapter');
const adapter=new HeAdapter(path.join(__dirname,'..','backups','smoke')),log={layers:[]},originals=[];
app.on('browser-window-created',(_event,win)=>{
  win.hide();win.webContents.on('did-finish-load',async()=>{
    const evaluate=code=>win.webContents.executeJavaScript(code);
    const ready=async()=>{for(let i=0;i<100;i++){if(await evaluate("!document.getElementById('save').disabled"))return;await new Promise(r=>setTimeout(r,100));}throw new Error('UI not ready');};
    try{
      await ready();for(const layer of [0,1])originals[layer]=adapter.exportHeProfile(layer);
      fs.writeFileSync(path.join(__dirname,'..','backups',`group-${Date.now()}.json`),JSON.stringify(originals));
      for(const layer of [0,1]){
        if(layer){await evaluate("document.querySelectorAll('.profiles button')[1].click();void 0");await ready();}
        const before=adapter.readProfile(layer),other=adapter.readProfile(1-layer);
        await evaluate("document.querySelector('.key[data-id=\"2:1\"]').click();document.querySelector('.key[data-id=\"2:2\"]').dispatchEvent(new MouseEvent('click',{ctrlKey:true,bubbles:true}));document.querySelector('.key[data-id=\"2:3\"]').dispatchEvent(new MouseEvent('click',{ctrlKey:true,bubbles:true}));document.getElementById('mode-mechanical').click();document.getElementById('fixedDown').value='1.102';document.getElementById('fixedUp').value='1.104';void 0");
        assert.equal(await evaluate("document.querySelectorAll('.key.chosen').length"),3);
        assert.deepEqual(adapter.readProfile(layer).keys,before.keys);
        await evaluate("document.getElementById('save').click();void 0");await ready();
        const after=adapter.readProfile(layer);const expected=before.keys.map((key,i)=>[29,30,31].includes(i)?{...key,rtOn:false,fixedDown:1.102,fixedUp:1.104}:key);
        assert.deepEqual(after.keys,expected);assert.deepEqual(adapter.readProfile(1-layer).keys,other.keys);
        await evaluate("document.getElementById('fixedDown').value='2.000';document.querySelectorAll('aside .nav')[3].click();document.querySelectorAll('aside .nav')[0].click();void 0");
        assert.equal(await evaluate("document.getElementById('fixedDown').value"),'1.102');assert.deepEqual(adapter.readProfile(layer).keys,expected);
        await evaluate("document.getElementById('mode-rt').click();document.getElementById('head').value='0.222';document.getElementById('bottom').value='0.224';document.getElementById('trigger').value='0.226';document.getElementById('release').value='0.228';document.getElementById('save').click();void 0");await ready();
        for(const i of [29,30,31])Object.assign(expected[i],{rtOn:true,head:0.222,bottom:0.224,trigger:0.226,release:0.228});
        assert.deepEqual(adapter.readProfile(layer).keys,expected);assert.deepEqual(adapter.readProfile(1-layer).keys,other.keys);
        log.layers.push({layer,groupVerified:true,rtGroupVerified:true,otherProfileUnchanged:true,sectionDiscardVerified:true});
      }
      await evaluate("document.getElementById('head').value='2.000';document.querySelectorAll('.profiles button')[0].click();void 0");await ready();
      await evaluate("document.querySelectorAll('.profiles button')[1].click();void 0");await ready();
      assert.equal(await evaluate("document.getElementById('head').value"),'0.222');log.profileDiscardVerified=true;
      await evaluate("document.getElementById('head').value='2.000';void 0");
      win.destroy();assert.equal(adapter.readProfile(1).keys[29].head,0.222);log.closeDiscardVerified=true;log.ok=true;
    }catch(error){log.ok=false;log.error=error.stack;}
    finally{
      for(let layer=0;layer<originals.length;layer++)try{adapter.importHeProfile(layer,originals[layer]);assert.deepEqual(adapter.exportHeProfile(layer),originals[layer]);}catch(error){log.ok=false;log.restoreError=error.stack;}
      log.restored=!log.restoreError;fs.writeFileSync(path.join(__dirname,'..','electron-group-result.json'),JSON.stringify(log,null,2));app.exit(log.ok?0:1);
    }
  });
});
// Keep the process alive through the close test and restoration.
app.on('window-all-closed',()=>{});
require('./main');
app.removeAllListeners('window-all-closed');
