'use strict';
const {app,BrowserWindow,desktopCapturer,session,ipcMain}=require('electron'),fs=require('node:fs'),path=require('node:path');
const {computeEqFft}=require('./eq-fft'),{computeEqBands}=require('./eq-bands'),{encodeEqSpectrum}=require('./eq-spectrum'),{encodeOutputReport}=require('./hid-frame');
app.setPath('userData',path.join(app.getPath('temp'),'m6-eq-audio-check'));
let win;const report={audioSaved:false,deviceWrites:false};
let deviceSession=null,deviceStyle=1,finished=false;
report.spectrumFrames=0;
ipcMain.handle('eq-diagnostic:frame',(event,frame)=>{
 if(!win||event.sender!==win.webContents)throw Error('Unexpected diagnostic sender');
 const bins=computeEqFft(frame),levels=computeEqBands(bins,{style:deviceStyle,mainGain:deviceSession?70:0}),packet=encodeOutputReport(encodeEqSpectrum(levels));
 if(deviceSession)deviceSession.send(levels);
 if(packet.length!==21)throw Error('Invalid HID frame');report.spectrumFrames++;
 return true;
});
const timeout=setTimeout(()=>{report.ok=false;report.error='Audio capture timed out';finish();},30000);
function finish(){if(finished)return;finished=true;clearTimeout(timeout);if(win&&!win.isDestroyed())win.destroy();if(deviceSession){try{report.restoration=deviceSession.stop();}catch(error){report.ok=false;report.restoreError=error.stack;}}fs.writeFileSync(path.resolve(__dirname,process.argv.includes('--device')?'../lighting-eq-live-device-verification.json':'../lighting-eq-audio-verification.json'),JSON.stringify(report,null,2));console.log(report);app.exit(report.ok?0:1);}
app.whenReady().then(async()=>{
 try{
  if(process.argv.includes('--device')){const {HeAdapter}=require('./he-adapter'),{EqDeviceSession}=require('./eq-device-session');const root=path.resolve(__dirname,'../backups');deviceSession=new EqDeviceSession(new HeAdapter(root),root);report.session=deviceSession.start();deviceStyle=report.session.style;report.deviceWrites=true;}
  session.defaultSession.setDisplayMediaRequestHandler(async(_request,callback)=>{try{const sources=await desktopCapturer.getSources({types:['screen'],thumbnailSize:{width:0,height:0}});if(!sources.length)return callback({});callback({video:sources[0],audio:'loopback'});}catch{callback({});}});
  win=new BrowserWindow({show:false,webPreferences:{preload:path.join(__dirname,'eq-audio-check-preload.cjs'),contextIsolation:true,nodeIntegration:false}});await win.loadFile(path.join(__dirname,'eq-audio-check.html'));
  report.result=await win.webContents.executeJavaScript(`(async()=>{
   const capture=new EqAudioCapture(),result={};let count=0,invalid=0,pending=null,processingError=null;
   try{
    await capture.start(frame=>{count++;if(!(frame instanceof Float32Array)||frame.length!==2048||frame.some(x=>!Number.isFinite(x)||Math.abs(x)>1))invalid++;if(!pending)pending=eqDiagnostic.process(frame).catch(error=>{processingError=error.message;}).finally(()=>{pending=null;});});
    const tracks=capture.resources.stream.getTracks(),context=capture.resources.context;
    result.sampleRate=context.sampleRate;result.videoStopped=tracks.filter(t=>t.kind==='video').every(t=>t.readyState==='ended');
    await new Promise(resolve=>setTimeout(resolve,1800));await capture.stop();if(pending)await pending;result.processingError=processingError;
    result.frames=count;result.invalid=invalid;result.tracksStopped=tracks.every(t=>t.readyState==='ended');result.contextClosed=context.state==='closed';
    const stoppedCount=count;await new Promise(resolve=>setTimeout(resolve,200));result.noFramesAfterStop=count===stoppedCount;
    return result;
   }finally{await capture.stop();}
  })()`);
  const r=report.result;report.ok=r.sampleRate===44100&&r.frames>0&&r.invalid===0&&r.videoStopped&&r.tracksStopped&&r.contextClosed&&r.noFramesAfterStop&&!r.processingError&&report.spectrumFrames>0;
 }catch(error){report.ok=false;report.error=error.stack;}finally{finish();}
});
