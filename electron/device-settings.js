'use strict';
const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
function readSettings(raw){
 if(!Buffer.isBuffer(raw)||raw.length<14)throw Error('Incomplete device settings');
 return {performanceMode:raw[3],fpsEnhance:raw[12],autoCalibration:raw[13],windowsLock:raw[5],fnAltSwap:raw[10],canEditFps:[0,1].includes(raw[12]),canEditPerformance:[0,1,2].includes(raw[3]),performanceName:["BeastMode","EyeMode","DevMode"][raw[3]]||"Unknown mode"};
}
async function applyFps(adapter,root,enabled,options){
 if(typeof enabled!=='boolean')throw Error('FPS Enhance must be enabled or disabled');
 return applySetting(adapter,root,12,enabled?1:0,options);
}
async function applyPerformanceMode(adapter,root,mode,options){
 if(![0,1,2].includes(mode))throw Error('Select BeastMode, EyeMode or DevMode');
 // Changing the performance mode intentionally reboots the controller. A
 // readback on the old HID session can block while the configuration
 // interface disappears, so verify the command before the reboot and let the
 // next explicit Refresh read the new session.
 return applySetting(adapter,root,3,mode,{...(options||{}),verifyReadback:false,reconnectExpected:true});
}
async function applySetting(adapter,root,field,value,{wait=ms=>new Promise(r=>setTimeout(r,ms)),verifyReadback=true,reconnectExpected=false}={}){
 const backup=path.join(root,'device-settings-'+randomUUID()),kinds=[1,2,4,24,25,26,6,7,9,17],before={};
 fs.mkdirSync(backup,{recursive:true});
 adapter.transaction(device=>{for(const kind of kinds){before[kind]=device.readInit(kind);fs.writeFileSync(path.join(backup,`before-${kind}.bin`),before[kind]);}});
 const settings=readSettings(before[1]);if(field===12?!settings.canEditFps:!settings.canEditPerformance)throw Error('Unsupported device setting value');
 const expected=Buffer.from(before[1]);expected[field]=value;
 if(expected.equals(before[1]))return {...settings,verified:true,changed:false,backup};
 const dispatch=config=>{
  const payload=Buffer.alloc(20);payload.set([8,2]);config.copy(payload,2,0,14);
  // A successful write can detach the interface immediately. Never resend it
  // just because acknowledgement/readback uses the old HID handle.
  try{adapter.transaction(device=>device.send(payload));return null;}catch(error){return error.message;}
 };
 const verify=async config=>{
  let lastError;
  for(let attempt=0;attempt<10;attempt++){
   await wait(300);
   try{
    adapter.transaction(device=>{for(const kind of kinds){
     const actual=device.readInit(kind),want=kind===1?config:before[kind],limit=kind===6?218:want.length;
     if(actual.length!==want.length||!actual.subarray(0,limit).equals(want.subarray(0,limit))){fs.writeFileSync(path.join(backup,`mismatch-${kind}.bin`),actual);throw Error(`Device settings readback mismatch in INIT${kind}`);}
    }});return;
   }catch(error){lastError=error;}
  }
  throw lastError;
 };
 const dispatchError=dispatch(expected);
 if(!verifyReadback){
  if(dispatchError)throw Error(`Device settings write failed: ${dispatchError}`);
  fs.writeFileSync(path.join(backup,'result.json'),JSON.stringify({verified:true,reconnectPending:reconnectExpected,dispatchError},null,2));
  return {...readSettings(expected),verified:true,changed:true,reconnectPending:reconnectExpected,backup};
 }
 try{await verify(expected);}
 catch(error){
  const restoreDispatchError=dispatch(before[1]);
  try{await verify(before[1]);}
  catch(restore){throw Error(`${error.message}. Restoration failed: ${restore.message}. Dispatch: ${restoreDispatchError||'sent'}. Backup: ${backup}`);}
  throw Error(`${error.message}. Original device settings restored. Backup: ${backup}`);
 }
 fs.writeFileSync(path.join(backup,'result.json'),JSON.stringify({verified:true,dispatchError},null,2));
 return {...readSettings(expected),verified:true,changed:true,backup};
}
module.exports={readSettings,applyFps,applyPerformanceMode};
