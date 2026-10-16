'use strict';
const {app,BrowserWindow}=require('electron'),fs=require('node:fs'),path=require('node:path');
app.setPath('userData',fs.mkdtempSync(path.join(app.getPath('temp'),'m6-navigation-')));
require('./main');
app.whenReady().then(async()=>{
 try{
 let win;for(let i=0;i<100;i++){win=BrowserWindow.getAllWindows()[0];if(win&&!win.webContents.isLoading())break;await new Promise(r=>setTimeout(r,100));}
 for(let i=0;i<100;i++){if(await win.webContents.executeJavaScript('!!profile && !!programming && !busy'))break;await new Promise(r=>setTimeout(r,100));}
 const result=await win.webContents.executeJavaScript(`(async()=>{
 if(!profile||!programming||busy)throw Error('Profile not ready');
 const nav=document.querySelectorAll('aside .nav');nav[3].click();
 const saved=$('dks-interval').value;$('dks-interval').value='77';
 advancedPanel.querySelector('[data-action="programming-back"]').click();
 if(!advancedPanel.hidden||hePanel.hidden)throw Error('Back navigation failed');
 nav[3].click();if($('dks-interval').value!==saved)throw Error('Draft survived Back');
 nav[2].click();const key=programming.keys.find(k=>k.row+':'+k.col===$('remap-source').value),mode=key.mode;
 key.mode=1;setBusy(true);setBusy(false);
 if(!$('key-enabled-apply').disabled||!$('key-enabled').disabled)throw Error('Advanced-mode controls reenabled');
 for(const supported of [0,2,3,4,5,6]){key.mode=supported;setBusy(true);setBusy(false);updateRemapState();if($('key-enabled-apply').disabled)throw Error('Supported lock control disabled');}
 key.mode=mode;updateRemapState();
 const locked=key.locked;key.locked=1;setBusy(false);
 const offButton=[...$('keyboard').querySelectorAll('.key')].find(b=>b.dataset.id===key.row+':'+key.col);
 if(!offButton.classList.contains('key-off')||offButton.disabled||!offButton.getAttribute('aria-label').includes('key disabled'))throw Error('Disabled key indication failed');
 if(!keyStateSummary.textContent.includes('Disabled keys:'))throw Error('Disabled summary absent');
 const stored=programming;programming=null;setBusy(false);
 if(offButton.classList.contains('key-off')||!keyStateSummary.textContent.includes('unavailable'))throw Error('Stale disabled state');
 programming=stored;key.locked=locked;setBusy(false);

 remapPanel.querySelector('[data-action="programming-back"]').click();
 if(!remapPanel.hidden||hePanel.hidden)throw Error('Remap Back failed');
 [...nav].find(n=>n.dataset.title?.includes('Settings')).click();for(let i=0;i<100&&busy;i++)await new Promise(r=>setTimeout(r,50));
 if(busy||settingsPanel.hidden||!deviceSettings||$('device-fps-apply').disabled)throw Error('Device settings did not load: '+JSON.stringify({busy,hidden:settingsPanel.hidden,deviceSettings,status:$('device-settings-status').textContent,disabled:$('device-fps-apply').disabled}));
 const buttons=settingsPanel.querySelectorAll('[data-performance-mode]');
 if(buttons.length!==3||$('performance-name').textContent!==deviceSettings.performanceName)throw Error('Performance mode controls absent');
 const current=deviceSettings.performanceMode,next=(current+1)%3;
 buttons[next].click();if(performanceDraft!==next||deviceSettings.performanceMode!==current||buttons[next].getAttribute('aria-pressed')!=='true')throw Error('Mode draft failed');
 await deviceSettingsAction();if(performanceDraft!==current)throw Error('Refresh did not discard mode draft');
 nav[0].click();if(!settingsPanel.hidden)throw Error('Device settings did not close');
 return {ok:true,deviceSettingsRead:true,performanceModeDraft:true,backButtons:document.querySelectorAll('[data-action="programming-back"]').length,dksDraftDiscarded:true,disabledKeyIndicators:true,unknownStateCleared:true,unsupportedLockGuard:true,supportedLockModes:[0,2,3,4,5,6]};
 })()`);
 fs.writeFileSync(path.join(__dirname,'..','programming-navigation-verification.json'),JSON.stringify(result,null,2));console.log(result);
 }catch(e){console.error(e);process.exitCode=1;}finally{app.quit();}
});
