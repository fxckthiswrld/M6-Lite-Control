'use strict';
const {app}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
app.setPath('userData',path.join(app.getPath('temp'),'m6-lighting-smoke'));
const timer=setTimeout(()=>{console.error('Lighting smoke timed out');app.exit(1);},60000);
app.on('browser-window-created',(_event,win)=>{
 win.hide();win.webContents.once('did-finish-load',async()=>{
  const evaluate=code=>win.webContents.executeJavaScript(code),result={};
  const ready=async()=>{for(let i=0;i<150;i++){if(await evaluate("!document.getElementById('save').disabled"))return;await new Promise(r=>setTimeout(r,100));}throw Error('UI not ready');};
  try{
   await ready();
   await evaluate("document.querySelectorAll('aside .nav')[5].click();void 0");await ready();
   const state=await evaluate("({value:document.getElementById('lighting-brightness').valueAsNumber,status:document.getElementById('lighting-status').textContent,visible:!document.getElementById('lighting-read').closest('section').hidden,enabled:!document.getElementById('lighting-apply').disabled})");
   assert.equal(state.visible,true);assert.equal(state.enabled,true);assert.equal(state.status,'');assert.ok(Number.isInteger(state.value)&&state.value>=0&&state.value<=255);
   const backPower=await evaluate("({checked:document.getElementById('backlight-enabled').checked,enabled:!document.getElementById('backlight-enabled-apply').disabled})");
   assert.equal(backPower.enabled,true);
   await evaluate("document.getElementById('backlight-enabled').checked=!document.getElementById('backlight-enabled').checked;void 0");
   const mode=await evaluate("({value:document.getElementById('lighting-mode').value,enabled:!document.getElementById('lighting-mode-apply').disabled})");
   assert.equal(mode.enabled,true);assert.ok(['2','3','4','5','6','7'].includes(mode.value));
   assert.deepEqual(await evaluate("Array.from(document.getElementById('lighting-mode').options,o=>o.textContent)"),['EQ (system audio)','Normal','Stream','Gradient','Star','Roll','Breath']);
   const under=await evaluate("({mode:document.getElementById('underlight-mode').value,enabled:!document.getElementById('underlight-apply').disabled})");
   assert.equal(under.enabled,true);
   const single=await evaluate("({count:document.getElementById('single-keys').options.length,ready:!document.getElementById('single-active-apply').disabled,color:document.getElementById('single-color').value,enabled:document.getElementById('single-enabled').checked})");
   assert.equal(single.count,64);assert.equal(single.ready,true);
   for(const api of ['setBackLightEnabled','setUnderLightEnabled','setUnderLightSync','setSingleLight']){const reply=await evaluate(`window.keyboard.${api}(null)`);assert.equal(reply.ok,false);assert.ok(reply.error);}
   await evaluate("document.getElementById('single-color').value='#123456';document.getElementById('single-enabled').checked=!document.getElementById('single-enabled').checked;document.getElementById('single-read').click();void 0");await ready();
   assert.equal(await evaluate("document.getElementById('single-color').value"),single.color);
   assert.equal(await evaluate("document.getElementById('single-enabled').checked"),single.enabled);
   const underPower=await evaluate("({checked:document.getElementById('underlight-enabled').checked,enabled:!document.getElementById('underlight-enabled-apply').disabled})");
   assert.equal(underPower.enabled,true);
   await evaluate("document.getElementById('underlight-enabled').checked=!document.getElementById('underlight-enabled').checked;void 0");
   const underBrightness=await evaluate("({value:document.getElementById('underlight-brightness').valueAsNumber,enabled:!document.getElementById('underlight-brightness-apply').disabled})");
   assert.equal(underBrightness.enabled,true);assert.ok(Number.isInteger(underBrightness.value)&&underBrightness.value>=0&&underBrightness.value<=255);
   await evaluate("document.getElementById('underlight-brightness').value='256';document.getElementById('underlight-brightness-apply').click();void 0");
   assert.match(await evaluate("document.getElementById('underlight-status').textContent"),/0 to 255/);
   const underSpeed=await evaluate("({value:document.getElementById('underlight-speed').value,min:document.getElementById('underlight-speed').min,max:document.getElementById('underlight-speed').max,enabled:!document.getElementById('underlight-speed-apply').disabled})");
   assert.equal(underSpeed.enabled,under.mode!=='7');
   if(underSpeed.enabled){
    const ranges={'3':['1500','3000'],'4':['5000','20000'],'5':['2000','6000'],'6':['2000','4000']};assert.deepEqual([underSpeed.min,underSpeed.max],ranges[under.mode]);
    await evaluate("document.getElementById('underlight-speed').value=String(Number(document.getElementById('underlight-speed').max)+1);document.getElementById('underlight-speed-apply').click();void 0");
    assert.match(await evaluate("document.getElementById('underlight-status').textContent"),new RegExp(underSpeed.min+' to '+underSpeed.max));
   }
   await evaluate("document.getElementById('underlight-read').click();void 0");await ready();
   assert.equal(await evaluate("document.getElementById('underlight-brightness').valueAsNumber"),underBrightness.value);
   assert.equal(await evaluate("document.getElementById('underlight-enabled').checked"),underPower.checked);
   const underColor=await evaluate("({value:document.getElementById('underlight-color').value,custom:document.getElementById('underlight-custom-rgb').checked,enabled:!document.getElementById('underlight-color-apply').disabled})");
   assert.equal(underColor.enabled,['3','7'].includes(under.mode));
   assert.equal(await evaluate("document.getElementById('underlight-custom-rgb').closest('label').hidden"),under.mode==='7');
   assert.equal(await evaluate("document.getElementById('underlight-color').disabled"),!underColor.enabled||(under.mode==='3'&&!underColor.custom));
   await evaluate("document.getElementById('underlight-color').value='#abcdef';document.getElementById('underlight-custom-rgb').checked=true;void 0");
   assert.deepEqual(await evaluate("Array.from(document.getElementById('underlight-mode').options,o=>o.textContent)"),['Stream','Breath','Star','Gradient','Normal']);
   await evaluate("document.getElementById('underlight-mode').value=document.getElementById('underlight-mode').value==='7'?'5':'7';void 0");
   const speed=await evaluate("({value:document.getElementById('lighting-speed').value,min:document.getElementById('lighting-speed').min,max:document.getElementById('lighting-speed').max,enabled:!document.getElementById('lighting-speed-apply').disabled})");
   assert.equal(speed.enabled,mode.value!=='2');
   const reverse=await evaluate("({value:document.getElementById('lighting-reverse').checked,enabled:!document.getElementById('lighting-direction-apply').disabled})");
   assert.equal(reverse.enabled,['5','7'].includes(mode.value));
   await evaluate("document.getElementById('lighting-reverse').checked=!document.getElementById('lighting-reverse').checked;void 0");
   if(speed.enabled){await evaluate("document.getElementById('lighting-speed').value=String(Number(document.getElementById('lighting-speed').max)+1);document.getElementById('lighting-speed-apply').click();void 0");assert.match(await evaluate("document.getElementById('lighting-mode-status').textContent"),new RegExp(speed.min+' to '+speed.max));}
   const color=await evaluate("({value:document.getElementById('lighting-color').value,custom:document.getElementById('lighting-custom-rgb').checked,enabled:!document.getElementById('lighting-color-apply').disabled})");
   assert.equal(color.enabled,mode.value!=='4');
   await evaluate("document.getElementById('lighting-custom-rgb').checked=true;document.getElementById('lighting-custom-rgb').dispatchEvent(new Event('change'));document.getElementById('lighting-color').value='#abcdef';void 0");
   await evaluate("document.getElementById('lighting-mode').value='4';document.getElementById('lighting-mode').dispatchEvent(new Event('change'));void 0");
   assert.equal(await evaluate("document.getElementById('lighting-color-apply').disabled"),true);
   await evaluate("document.getElementById('lighting-mode').value=document.getElementById('lighting-mode').value==='2'?'5':'2';void 0");
   await evaluate("document.getElementById('lighting-brightness').value='256';document.getElementById('lighting-apply').click();void 0");
   assert.match(await evaluate("document.getElementById('lighting-status').textContent"),/whole number/);
   await evaluate("document.querySelectorAll('aside .nav')[0].click();void 0");await ready();
   assert.equal(await evaluate("document.getElementById('lighting-read').closest('section').hidden"),true);
   await evaluate("document.querySelectorAll('aside .nav')[5].click();void 0");await ready();
   assert.equal(await evaluate("document.getElementById('lighting-brightness').valueAsNumber"),state.value);
   assert.equal(await evaluate("document.getElementById('lighting-mode').value"),mode.value);
   assert.equal(await evaluate("document.getElementById('underlight-mode').value"),under.mode);
   assert.equal(await evaluate("document.getElementById('underlight-speed').value"),underSpeed.value);
   assert.equal(await evaluate("document.getElementById('underlight-color').value"),underColor.value);
   assert.equal(await evaluate("document.getElementById('underlight-custom-rgb').checked"),underColor.custom);
   assert.equal(await evaluate("document.getElementById('lighting-speed').value"),speed.value);
   assert.equal(await evaluate("document.getElementById('lighting-reverse').checked"),reverse.value);
   assert.equal(await evaluate("document.getElementById('lighting-color').value"),color.value);
   assert.equal(await evaluate("document.getElementById('lighting-custom-rgb').checked"),color.custom);
   assert.equal(await evaluate("document.getElementById('backlight-enabled').checked"),backPower.checked);
   await evaluate("document.getElementById('lighting-color').value='#abcdef';document.getElementById('underlight-color').value='#abcdef';document.querySelector('.profiles button.active').click();void 0");await ready();
   assert.equal(await evaluate("document.getElementById('lighting-color').value"),color.value);
   assert.equal(await evaluate("document.getElementById('underlight-color').value"),underColor.value);
   Object.assign(result,{ok:true,brightness:state.value,effect:mode.current,underLight:under.current,underLightSpeedRangeVerified:underSpeed.enabled,underLightSpeedDraftDiscarded:true,underLightColorDraftDiscarded:true,underLightColorEnabled:underColor.enabled,underLightDraftDiscarded:true,speedDraftDiscarded:true,speedInvalidValueTested:speed.enabled,colorDraftDiscarded:true,profileReloadDiscardsColor:true,gradientColorDisabled:true,effectDraftDiscarded:true,invalidValueRejected:true,draftDiscarded:true,deviceWrites:false});
  }catch(error){result.ok=false;result.error=error.stack;}
  finally{clearTimeout(timer);fs.writeFileSync(path.join(__dirname,'..','electron-lighting-result.json'),JSON.stringify(result,null,2));console.log(result);app.exit(result.ok?0:1);}
 });
});
require('./main');
