'use strict';
const {EqPreference}=require('./eq-preference');
const {EqDeviceSession}=require('./eq-device-session');
const {computeEqFft}=require('./eq-fft'),{computeEqBands}=require('./eq-bands');
function installEqHost({ipcMain,desktopCapturer,app,dialog},win,adapter,root,isBusy){
 const device=new EqDeviceSession(adapter,root),preference=new EqPreference(app.getPath('userData'));let style=1,permission=false,remembered=false;
 const owned=event=>{if(event.sender!==win.webContents)throw Error('Unexpected EQ sender');};
 const reply=action=>{try{return {ok:true,result:action()};}catch(error){return {ok:false,error:error.message,backup:device.backup};}};
 const stop=()=>{permission=false;return reply(()=>device.stop());};
 win.webContents.session.setDisplayMediaRequestHandler(async(request,callback)=>{
  if(!permission||device.state!=='running'||request.frame!==win.webContents.mainFrame)return callback({});
  permission=false;
  try{const sources=await desktopCapturer.getSources({types:['screen'],thumbnailSize:{width:0,height:0}});callback(device.state==='running'&&sources.length?{video:sources[0],audio:'loopback'}:{});}catch{callback({});}
 });
 ipcMain.handle('eq:start',event=>{owned(event);return reply(()=>{if(isBusy())throw Error('Wait for the current device operation');const result=device.start();remembered=false;style=result.style;permission=true;return result;});});
 ipcMain.handle('eq:frame',(event,frame)=>{owned(event);return reply(()=>{device.send(computeEqBands(computeEqFft(frame),{style,mainGain:70}));if(!remembered){preference.write(true);remembered=true;}return {sent:device.sent};});});
 ipcMain.handle('eq:stop',(event,forget=false)=>{owned(event);const result=stop();if(result.ok&&forget===true)return reply(()=>{preference.write(false);return result.result;});return result;});
 ipcMain.handle('eq:preference',event=>{owned(event);return reply(()=>({resume:preference.read()}));});
 const recover=()=>{const result=stop();if(!result.ok)dialog.showErrorBox('EQ restoration failed',`${result.error}\nBackup: ${device.backup}`);};
 win.webContents.on('render-process-gone',recover);
 win.webContents.on('will-navigate',event=>{event.preventDefault();});
 win.webContents.on('did-start-loading',()=>{if(device.state!=='idle')recover();});
 app.on('before-quit',recover);
 return {active:()=>device.state!=='idle'};
}
module.exports={installEqHost};
