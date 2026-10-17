'use strict';
const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const isFlag=value=>value===0||value===1;
const isDelay=value=>Number.isInteger(value)&&value>=1&&value<=30;
const isSaturation=value=>Number.isInteger(value)&&value>=64&&value<=255;
function readSettings(raw,light){
 if(!Buffer.isBuffer(raw)||raw.length<14)throw Error('Incomplete device settings');
 if(light!==undefined&&(!Buffer.isBuffer(light)||light.length!==24))throw Error('Incomplete lighting settings');
 return {performanceMode:raw[3],fpsEnhance:raw[12],autoCalibration:raw[13],windowsLock:raw[5],fnAltSwap:raw[10],canEditFps:isFlag(raw[12]),canEditPerformance:[0,1,2].includes(raw[3]),performanceName:["BeastMode","EyeMode","DevMode"][raw[3]]||"Unknown mode",
  canEditAutoCalibration:isFlag(raw[13]),autoLightOff:raw[8],autoLightOffMinutes:raw[9],canEditAutoLightOff:isFlag(raw[8]),
  ...(light?{highlight:light[4],canEditHighlight:isFlag(light[4]),saturation:[...light.subarray(0,3)],canEditSaturation:[...light.subarray(0,3)].every(isSaturation)}:{})};
}
async function applyFps(adapter,root,enabled,options){
 if(typeof enabled!=='boolean')throw Error('FPS Enhance must be enabled or disabled');
 return applySetting(adapter,root,{12:enabled?1:0},{...options,guard:s=>s.canEditFps});
}
async function applyPerformanceMode(adapter,root,mode,options){
 if(![0,1,2].includes(mode))throw Error('Select BeastMode, EyeMode or DevMode');
 // Changing the performance mode intentionally reboots the controller. A
 // readback on the old HID session can block while the configuration
 // interface disappears, so verify the command before the reboot and let the
 // next explicit Refresh read the new session.
 return applySetting(adapter,root,{3:mode},{...(options||{}),guard:s=>s.canEditPerformance,verifyReadback:false,reconnectExpected:true});
}
async function applyAutoCalibration(adapter,root,enabled,options){
 if(typeof enabled!=='boolean')throw Error('Auto calibration must be enabled or disabled');
 return applySetting(adapter,root,{13:Number(enabled)},{...options,includeLight:true,guard:s=>s.canEditAutoCalibration});
}
async function applyAutoLightOff(adapter,root,request,options){
 if(!request||typeof request.enabled!=='boolean')throw Error('Auto light off must be enabled or disabled');
 // Omitting minutes when disabling preserves even an unknown stored delay.
 if((request.enabled||request.minutes!==undefined)&&!isDelay(request.minutes))throw Error('Auto light off delay must be an integer from 1 to 30 minutes');
 const patch={8:Number(request.enabled)};if(request.minutes!==undefined)patch[9]=request.minutes;
 return applySetting(adapter,root,patch,{...options,includeLight:true,guard:s=>s.canEditAutoLightOff});
}
async function applyHighlight(adapter,root,enabled,options){
 if(typeof enabled!=='boolean')throw Error('Highlight must be enabled or disabled');
 return applySetting(adapter,root,{4:Number(enabled)},{...options,kind:17,includeLight:true,guard:s=>s.canEditHighlight});
}
async function applySaturation(adapter,root,rgb,options){
 if(!Array.isArray(rgb)||rgb.length!==3||!Array.from(rgb).every(isSaturation))throw Error('Saturation requires three integers from 64 to 255');
 return applySetting(adapter,root,{0:rgb[0],1:rgb[1],2:rgb[2]},{...options,kind:17,includeLight:true,guard:s=>s.canEditSaturation});
}
async function applySetting(adapter,root,patch,{kind=1,includeLight=false,guard,wait=ms=>new Promise(r=>setTimeout(r,ms)),verifyReadback=true,reconnectExpected=false}={}){
 const backup=path.join(root,'device-settings-'+randomUUID()),kinds=[1,2,4,24,25,26,6,7,9,17],before={};
 fs.mkdirSync(backup,{recursive:true});
 adapter.transaction(device=>{for(const kind of kinds){before[kind]=device.readInit(kind);fs.writeFileSync(path.join(backup,`before-${kind}.bin`),before[kind]);}});
 const settings=readSettings(before[1],includeLight?before[17]:undefined);if(!guard(settings))throw Error('Unsupported device setting value');
 const expected=Buffer.from(before[kind]);for(const [field,value] of Object.entries(patch))expected[field]=value;
 if(expected.equals(before[kind]))return {...settings,verified:true,changed:false,backup};
 const result=()=>readSettings(kind===1?expected:before[1],includeLight?(kind===17?expected:before[17]):undefined);
 const dispatch=config=>{
  const payload=Buffer.alloc(20);payload.set([8,kind===1?2:17]);config.copy(payload,2,0,kind===1?14:18);
  // A successful write can detach the interface immediately. Never resend it
  // just because acknowledgement/readback uses the old HID handle.
  try{adapter.transaction(device=>device.send(payload));return null;}catch(error){return error.message;}
 };
 const verify=async config=>{
  let lastError;
  for(let attempt=0;attempt<10;attempt++){
   await wait(300);
   try{
    adapter.transaction(device=>{for(const section of kinds){
     const actual=device.readInit(section),want=section===kind?config:before[section],limit=section===6?218:want.length;
     if(actual.length!==want.length||!actual.subarray(0,limit).equals(want.subarray(0,limit))){fs.writeFileSync(path.join(backup,`mismatch-${section}.bin`),actual);throw Error(`Device settings readback mismatch in INIT${section}`);}
    }});return;
   }catch(error){lastError=error;}
  }
  throw lastError;
 };
 const dispatchError=dispatch(expected);
 if(!verifyReadback){
  if(dispatchError)throw Error(`Device settings write failed: ${dispatchError}`);
  fs.writeFileSync(path.join(backup,'result.json'),JSON.stringify({verified:true,reconnectPending:reconnectExpected,dispatchError},null,2));
  return {...result(),verified:true,changed:true,reconnectPending:reconnectExpected,backup};
 }
 try{await verify(expected);}
 catch(error){
  const restoreDispatchError=dispatch(before[kind]);
  try{await verify(before[kind]);}
  catch(restore){throw Error(`${error.message}. Restoration failed: ${restore.message}. Dispatch: ${restoreDispatchError||'sent'}. Backup: ${backup}`);}
  throw Error(`${error.message}. Original device settings restored. Backup: ${backup}`);
 }
 fs.writeFileSync(path.join(backup,'result.json'),JSON.stringify({verified:true,dispatchError},null,2));
 return {...result(),verified:true,changed:true,backup};
}
module.exports={readSettings,applyFps,applyPerformanceMode,applyAutoCalibration,applyAutoLightOff,applyHighlight,applySaturation};
