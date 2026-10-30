'use strict';
const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const layout=require('./keyboard-layout.json'),{encodeConfig}=require('./lighting-brightness');
// The keyboard drops packets that arrive back-to-back: without this gap only
// the first per-key record of a group is applied (verified on hardware).
function waitMilliseconds(milliseconds){if(milliseconds>0)Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,milliseconds);}
function readSingleLight(raw,config){
 if(!Buffer.isBuffer(raw)||raw.length!==840)throw Error('Expected 840-byte Single Light section');
 encodeConfig(config);
 return {enabled:config[6]===1,canEnable:[0,1].includes(config[6]),keys:layout.map(k=>{const o=(k.col*6+k.row)*10;return {id:k.id,label:k.label,enabled:raw[o]===1,mode:raw[o+1],brightness:raw[o+2],color:'#'+raw.subarray(o+3,o+6).toString('hex').toUpperCase(),canEdit:[0,1].includes(raw[o])&&raw[o+1]===1};})};
}
function encodeSingle(raw,key){
 const o=(key.col*6+key.row)*10,p=Buffer.alloc(20);p.set([8,8,1,key.col,key.row]);raw.copy(p,5,o,o+6);return p;
}
function applySingleLight(device,backupRoot,request){
 if(!request||typeof request!=='object')throw Error('Expected Single Light request');
 if(Object.hasOwn(request,'mode'))throw Error('Single Light supports RGB and brightness editing only');
 const global=Object.hasOwn(request,'active');let keys=[];
 if(global){if(typeof request.active!=='boolean')throw Error('active must be a boolean');}
 else{
  if(!Array.isArray(request.keys)||!request.keys.length||new Set(request.keys).size!==request.keys.length)throw Error('Select unique keys');
  keys=request.keys.map(id=>{const k=layout.find(k=>k.id===id);if(!k)throw Error('Unknown key');return k;});
  if(!['enabled','color','brightness'].some(field=>Object.hasOwn(request,field)))throw Error('Expected RGB, brightness or key enable state');
  if(Object.hasOwn(request,'enabled')&&typeof request.enabled!=='boolean')throw Error('enabled must be a boolean');
  if(Object.hasOwn(request,'color')&&(typeof request.color!=='string'||!/^#[0-9a-f]{6}$/i.test(request.color)))throw Error('Expected #RRGGBB color');
  if(Object.hasOwn(request,'brightness')&&(!Number.isInteger(request.brightness)||request.brightness<0||request.brightness>255))throw Error('Brightness must be an integer from 0 to 255');
 }
 // Assigning a color activates the key and the Single Light layer, otherwise the stored RGB would never be
 // displayed (the vendor firmware only lights records whose actived byte is 1). An explicit enabled flag wins.
 const activates=!global&&(Object.hasOwn(request,'enabled')?request.enabled===true:Object.hasOwn(request,'color'));
 const backup=path.join(backupRoot,'single-light-'+randomUUID());fs.mkdirSync(backup,{recursive:true});
 const kinds=[1,2,4,24,25,26,6,7,9,17],before=new Map();
 for(const k of kinds){const b=device.readInit(k);before.set(k,b);fs.writeFileSync(path.join(backup,`init-${k}.bin`),b,{flag:'wx'});}
 const original=before.get(7),config=before.get(17),state=readSingleLight(original,config),expected=Buffer.from(original),desiredConfig=Buffer.from(config);
 if(global){if(!state.canEnable)throw Error('Unknown Single Light enable state');desiredConfig[6]=Number(request.active);}
 else{
  for(const key of keys){if(!state.keys.find(k=>k.id===key.id).canEdit)throw Error('Only Normal Single Light records can currently be edited safely');const o=(key.col*6+key.row)*10;if(Object.hasOwn(request,'enabled'))expected[o]=Number(request.enabled);else if(Object.hasOwn(request,'color'))expected[o]=1;if(Object.hasOwn(request,'brightness'))expected[o+2]=request.brightness;if(Object.hasOwn(request,'color'))Buffer.from(request.color.slice(1),'hex').copy(expected,o+3);}
  if(activates&&state.canEnable)desiredConfig[6]=1;
 }
 const attempted=[];
 function verify(raw,cfg,label){for(const k of kinds){const observed=device.readInit(k),target=k===7?raw:k===17?cfg:before.get(k),n=k===6?218:target.length;fs.writeFileSync(path.join(backup,`${label}-${k}.bin`),observed);if(observed.length!==target.length||!observed.subarray(0,n).equals(target.subarray(0,n)))throw Error(`Readback mismatch in INIT${k}`);}}
 // The keyboard only redraws the Single Light overlay once it receives a light
 // configuration packet (INIT17). Verified on hardware 2026-10-30: per-key SINGLE
 // records persist either way, but they stay invisible until INIT17 follows them,
 // so the configuration is re-sent around the key records even when it is unchanged.
 try{if(global)device.send(encodeConfig(desiredConfig));
  else{
   // The firmware repaints the Single Light overlay only when a light-config
   // packet differs from its current content (verified on hardware: identical
   // packets are ignored, so a rewritten colour stays invisible). Cycle the
   // layer flag off and back on around the per-key records to force the redraw.
   const off=Buffer.from(desiredConfig);off[6]=0;
   device.send(encodeConfig(off));waitMilliseconds(25);
   for(const key of keys){attempted.push(key);device.send(encodeSingle(expected,key));waitMilliseconds(15);}
   device.send(encodeConfig(desiredConfig));waitMilliseconds(25);
  }
  verify(expected,desiredConfig,'applied');}
 catch(error){try{for(const key of attempted)device.send(encodeSingle(original,key));device.send(encodeConfig(config));verify(original,config,'restored');}catch(restore){throw Error(`${error.message}; restoration unverified: ${restore.message}. Backup: ${backup}`);}throw Error(`${error.message}; original Single Light settings restored. Backup: ${backup}`);}
 return {...readSingleLight(expected,desiredConfig),verified:true,backup};
}
module.exports={readSingleLight,encodeSingle,applySingleLight};
