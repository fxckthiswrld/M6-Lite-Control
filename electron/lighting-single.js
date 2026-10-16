'use strict';
const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const layout=require('./keyboard-layout.json'),{encodeConfig}=require('./lighting-brightness');
function readSingleLight(raw,config){
 if(!Buffer.isBuffer(raw)||raw.length!==840)throw Error('Expected 840-byte Single Light section');
 encodeConfig(config);
 return {enabled:config[6]===1,canEnable:[0,1].includes(config[6]),keys:layout.map(k=>{const o=(k.col*6+k.row)*10;return {id:k.id,label:k.label,enabled:raw[o]===1,mode:raw[o+1],color:'#'+raw.subarray(o+3,o+6).toString('hex').toUpperCase(),canEdit:[0,1].includes(raw[o])&&raw[o+1]===1};})};
}
function encodeSingle(raw,key){
 const o=(key.col*6+key.row)*10,p=Buffer.alloc(20);p.set([8,8,1,key.col,key.row]);raw.copy(p,5,o,o+6);return p;
}
function applySingleLight(device,backupRoot,request){
 if(!request||typeof request!=='object')throw Error('Expected Single Light request');
 const global=Object.hasOwn(request,'active');let keys=[];
 if(global){if(typeof request.active!=='boolean')throw Error('active must be a boolean');}
 else{
  if(!Array.isArray(request.keys)||!request.keys.length||new Set(request.keys).size!==request.keys.length)throw Error('Select unique keys');
  keys=request.keys.map(id=>{const k=layout.find(k=>k.id===id);if(!k)throw Error('Unknown key');return k;});
  if(typeof request.enabled!=='boolean'||typeof request.color!=='string'||!/^#[0-9a-f]{6}$/i.test(request.color))throw Error('Expected enabled boolean and #RRGGBB color');
 }
 const backup=path.join(backupRoot,'single-light-'+randomUUID());fs.mkdirSync(backup,{recursive:true});
 const kinds=[1,2,4,24,25,26,6,7,9,17],before=new Map();
 for(const k of kinds){const b=device.readInit(k);before.set(k,b);fs.writeFileSync(path.join(backup,`init-${k}.bin`),b,{flag:'wx'});}
 const original=before.get(7),config=before.get(17),state=readSingleLight(original,config),expected=Buffer.from(original),desiredConfig=Buffer.from(config);
 if(global){if(!state.canEnable)throw Error('Unknown Single Light enable state');desiredConfig[6]=Number(request.active);}
 else for(const key of keys){if(!state.keys.find(k=>k.id===key.id).canEdit)throw Error('Only Normal Single Light records can currently be edited safely');const o=(key.col*6+key.row)*10;expected[o]=Number(request.enabled);expected[o+2]=255;Buffer.from(request.color.slice(1),'hex').copy(expected,o+3);}
 const attempted=[];
 function verify(raw,cfg,label){for(const k of kinds){const observed=device.readInit(k),target=k===7?raw:k===17?cfg:before.get(k),n=k===6?218:target.length;fs.writeFileSync(path.join(backup,`${label}-${k}.bin`),observed);if(observed.length!==target.length||!observed.subarray(0,n).equals(target.subarray(0,n)))throw Error(`Readback mismatch in INIT${k}`);}}
 try{if(global)device.send(encodeConfig(desiredConfig));else for(const key of keys){attempted.push(key);device.send(encodeSingle(expected,key));}verify(expected,desiredConfig,'applied');}
 catch(error){try{if(global)device.send(encodeConfig(config));else for(const key of attempted)device.send(encodeSingle(original,key));verify(original,config,'restored');}catch(restore){throw Error(`${error.message}; restoration unverified: ${restore.message}. Backup: ${backup}`);}throw Error(`${error.message}; original Single Light settings restored. Backup: ${backup}`);}
 return {...readSingleLight(expected,desiredConfig),verified:true,backup};
}
module.exports={readSingleLight,encodeSingle,applySingleLight};
