'use strict';
const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
function encodeConfig(raw){
 if(!Buffer.isBuffer(raw)||raw.length!==24)throw new Error('Expected 24-byte lighting configuration');
 const payload=Buffer.alloc(20);payload.set([8,17]);raw.copy(payload,2,0,18);return payload;
}
function applyBrightness(device,backupRoot,value,field=3){
 if(field!==3&&field!==10)throw new RangeError('Unsupported brightness field');
 if(!Number.isInteger(value)||value<0||value>255)throw new RangeError('Brightness must be an integer from 0 to 255');
 return {...applyConfigField(device,backupRoot,field,value),brightness:value};
}
function applyUnderLightEnabled(device,backupRoot,enabled){
 if(typeof enabled!=='boolean')throw new TypeError('Under Light enabled must be a boolean');
 return {...applyConfigField(device,backupRoot,9,enabled?1:0),enabled};
}
function applyBackLightEnabled(device,backupRoot,enabled){
 if(typeof enabled!=='boolean')throw new TypeError('Back Light enabled must be a boolean');
 return {...applyConfigField(device,backupRoot,5,enabled?1:0),enabled};
}
function applyUnderLightSync(device,backupRoot,sync){
 if(typeof sync!=='boolean')throw new TypeError('Under Light sync must be a boolean');
 return {...applyConfigField(device,backupRoot,11,sync?1:0),sync};
}
function applyConfigField(device,backupRoot,field,value){
 const backup=path.join(backupRoot,'lighting-config-'+randomUUID());fs.mkdirSync(backup,{recursive:true});
 const kinds=[1,2,4,24,25,26,6,7,9,17],before=new Map();
 for(const kind of kinds){const raw=device.readInit(kind);before.set(kind,raw);fs.writeFileSync(path.join(backup,`init-${kind}.bin`),raw,{flag:'wx'});}
 const original=before.get(17);encodeConfig(original);
 if(original[field]===value)return {verified:true,changed:false,backup};
 const expected=Buffer.from(original);expected[field]=value;
 function verify(config){
  for(const kind of kinds){
   const observed=device.readInit(kind),expected=kind===17?config:before.get(kind);
   // The 218-byte Back Light configuration is followed by an unknown tail
   // that changes between reads. Retain it, but do not mistake it for settings.
   if(kind===6)fs.appendFileSync(path.join(backup,'backlight-tail.jsonl'),JSON.stringify({before:expected.subarray(218).toString('hex'),observed:observed.subarray(218).toString('hex')})+'\n');
   const limit=kind===6?218:expected.length;
   if(observed.length!==expected.length||!observed.subarray(0,limit).equals(expected.subarray(0,limit)))throw new Error(`Readback mismatch in INIT${kind}`);
  }
 }
 try{device.send(encodeConfig(expected));verify(expected);}
 catch(error){
  try{device.send(encodeConfig(original));verify(original);}
  catch(restore){throw new Error(`${error.message}; restoration unverified: ${restore.message}. Backup: ${backup}`);}
  throw new Error(`${error.message}; original configuration restored. Backup: ${backup}`);
 }
 return {verified:true,changed:true,backup,persistence:'Live readback verified; use Save to device memory for persistence'};
}
module.exports={encodeConfig,applyBrightness,applyUnderLightEnabled,applyUnderLightSync,applyBackLightEnabled};
