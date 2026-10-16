'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {installBackground}=require('./background-lifecycle');
function setup(args=[]){
 const app=new EventEmitter(),win=new EventEmitter(),calls=[];let tray,menu;
 Object.assign(app,{isPackaged:false,getPath:()=>require('node:os').tmpdir(),quit:()=>{app.emit('before-quit');win.emit('close',{preventDefault:()=>calls.push('prevent')});app.emit('will-quit');}});
 Object.assign(win,{isDestroyed:()=>false,isMinimized:()=>false,show:()=>calls.push('show'),focus:()=>{},hide:()=>calls.push('hide')});
 class Tray extends EventEmitter{constructor(){super();tray=this;}setToolTip(){}setContextMenu(value){menu=value;}destroy(){calls.push('destroy');}}
 installBackground({app,Tray,Menu:{buildFromTemplate:x=>x},nativeImage:{createFromBitmap:()=>({})},dialog:{}},win,{args});
 return {app,win,calls,tray,menu};
}
test('background launch remains hidden; tray opens it; Close hides; Exit quits',()=>{
 const s=setup(['--background']);assert.deepEqual(s.calls,[]);
 s.tray.emit('double-click');assert.deepEqual(s.calls,['show']);
 s.win.emit('close',{preventDefault:()=>s.calls.push('prevent')});assert.deepEqual(s.calls,['show','prevent','hide']);
 s.menu.at(-1).click();assert.deepEqual(s.calls,['show','prevent','hide','destroy']);
});
test('normal launch shows the window and development never registers startup',()=>{
 const s=setup();assert.deepEqual(s.calls,['show']);assert.equal(s.menu[1].enabled,false);
});
