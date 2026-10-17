'use strict';
// Read-only packaged UI check, including the visible Single tab and controls.
const {app}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const application=path.resolve(process.env.M6_SINGLE_APP||__dirname),output=path.resolve(__dirname,'../backups/single-rgb-ui-smoke');fs.mkdirSync(output,{recursive:true});
app.setPath('userData',path.join(output,'app-data'));
app.on('browser-window-created',(_event,win)=>win.webContents.once('did-finish-load',async()=>{
 const evaluate=code=>win.webContents.executeJavaScript(code),report={application};
 const wait=async code=>{for(let i=0;i<200;i++){if(await evaluate(code))return;await new Promise(r=>setTimeout(r,100));}throw Error('UI condition timed out: '+code);};
 const press=async selector=>{
  const rect=await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};})()`);
  win.webContents.sendInputEvent({type:'mouseMove',...rect});win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...rect});win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...rect});
 };
 try{
  win.show();win.focus();
  await wait("window.m6UI?.snapshot().connected && !window.m6UI.snapshot().busy && [...document.querySelectorAll('button.route-button')].some(b=>b.textContent.includes('Lighting Effect')&&!b.disabled)");
  await evaluate("[...document.querySelectorAll('button.route-button')].find(b=>b.textContent.includes('Lighting Effect')).setAttribute('data-single-smoke-route','true');void 0");
  await press('[data-single-smoke-route]');
  await wait("window.m6UI.snapshot().page==='lighting' && !window.m6UI.snapshot().busy && !document.querySelector('[data-key=single]').disabled && !document.getElementById('single-brightness').disabled");
  await wait("document.querySelector('[data-key=single]').getAttribute('aria-disabled')!=='true' && document.querySelector('[data-key=single]').getAttribute('data-disabled')!=='true'");
  await new Promise(r=>setTimeout(r,500));await press('[data-key=single]');
  await wait("document.querySelector('[data-key=single]').getAttribute('aria-selected')==='true' && !document.querySelector('[data-lighting-layer=single]').hidden");
  const controls=await evaluate("({modeAbsent:!document.getElementById('single-mode'),brightnessEnabled:!document.getElementById('single-brightness').disabled,rgbEnabled:!document.getElementById('single-color').disabled,keys:document.getElementById('single-keys').options.length,percent:document.getElementById('single-brightness-value').value})");
  assert.equal(controls.modeAbsent,true);assert.equal(controls.brightnessEnabled,true);assert.equal(controls.rgbEnabled,true);assert.equal(controls.keys,64);
  await evaluate("document.getElementById('single-brightness').scrollIntoView({block:'center'});void 0");await new Promise(r=>setTimeout(r,300));
  fs.writeFileSync(path.join(output,'single-rgb-brightness.png'),(await win.webContents.capturePage()).toPNG());report.controls=controls;report.ok=true;
 }catch(error){report.ok=false;report.error=error.stack;report.tab=await evaluate("document.querySelector('[data-key=single]')?.outerHTML");fs.writeFileSync(path.join(output,'failed-ui.png'),(await win.webContents.capturePage()).toPNG());}
 fs.writeFileSync(path.resolve(__dirname,'../lighting-single-rgb-ui-smoke.json'),JSON.stringify(report,null,2));console.log(report);app.exit(report.ok?0:1);
}));
require(path.join(application,'main'));
