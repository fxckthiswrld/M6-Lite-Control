'use strict';
const electron=require('electron'),{app,BrowserWindow}=electron;
const assert=require('node:assert/strict');
app.setPath('userData',require('node:path').join(app.getPath('temp'),'m6-background-check'));
app.whenReady().then(async()=>{
 try{
  const win=new BrowserWindow({show:false});
  const lifecycle=require('./background-lifecycle').installBackground(electron,win,{args:['--background']});
  await win.loadURL('data:text/html,Background%20test');
  assert.equal(win.isVisible(),false);lifecycle.show();assert.equal(win.isVisible(),true);
  win.close();assert.equal(win.isDestroyed(),false);assert.equal(win.isVisible(),false);
  lifecycle.show();assert.equal(win.isVisible(),true);
  console.log('PASS: real Electron tray, background launch, hide on close, reopen');
  app.quit();
 }catch(error){console.error(error);app.exit(1);}
});
