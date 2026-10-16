'use strict';
const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const names={1:'EQ',2:'Normal',3:'Breath',4:'Gradient',5:'Stream',6:'Star',7:'Roll'};
const speedRanges=Object.freeze({3:[1500,3000],4:[5000,20000],5:[2000,6000],6:[2000,5000],7:[3007,6000]});
const supportedModes=Object.freeze([2,3,4,5,6,7]);
function readBackLight(raw){
 if(!Buffer.isBuffer(raw)||raw.length!==228)throw Error('Expected 228-byte Back Light section');
 const mode=raw[0],offset=8+(mode-2)*10,canEditColor=[2,3,5,6,7].includes(mode);
 return {mode,name:names[mode]||'Unknown',canSwitch:supportedModes.includes(mode),supportedModes:[...supportedModes],canEditColor,supportsCustomRgb:canEditColor&&mode!==6,
  canEditSpeed:!!speedRanges[mode],...(speedRanges[mode]?{speed:raw.readUInt16LE(offset+6),speedMinimum:speedRanges[mode][0],speedMaximum:speedRanges[mode][1]}:{}),
  canEditDirection:[5,7].includes(mode),...([5,7].includes(mode)?{reverse:raw[offset]===1}:{}),
  ...(canEditColor?{customRgb:raw[offset+2]===1,color:'#'+raw.subarray(offset+3,offset+6).toString('hex').toUpperCase()}: {})};
}
function encodeMode(raw,mode){
 readBackLight(raw);
 if(!supportedModes.includes(mode))throw Error('Unsupported Back Light mode');
 const offset=8+(mode-2)*10,record=raw.subarray(offset,offset+10);
 const payload=Buffer.alloc(20);payload.set([8,5,mode]);
 if([5,7].includes(mode))payload[3]=record[0];
 if(mode!==2)record.copy(payload,4,6,8);
 if(mode===6)record.copy(payload,6,8,10);
 if(mode!==4){payload[8]=record[2];record.copy(payload,9,3,6);}
 return payload;
}
function applyBackLightMode(device,backupRoot,mode,colorOptions,speedOptions,directionOptions){
 if(!supportedModes.includes(mode))throw Error('Unsupported Back Light mode');
 if(colorOptions!==undefined){
  if(![2,3,5,6,7].includes(mode))throw Error('This effect does not support custom color');
  if(!colorOptions||typeof colorOptions.customRgb!=='boolean'||typeof colorOptions.color!=='string'||!/^#[0-9a-f]{6}$/i.test(colorOptions.color))throw Error('Expected customRgb boolean and #RRGGBB color');
  if(mode===6&&colorOptions.customRgb)throw Error('Star has direct color without a Custom RGB toggle');
 }
 if(speedOptions!==undefined){
  if(!speedRanges[mode])throw Error('This effect has no speed control');
  const [min,max]=speedRanges[mode];
  if(!speedOptions||!Number.isInteger(speedOptions.speed)||speedOptions.speed<min||speedOptions.speed>max)throw Error(`Speed must be an integer from ${min} to ${max}`);
 }
 if(directionOptions!==undefined){
  if(![5,7].includes(mode))throw Error('Direction editing is verified for Stream and Roll only');
  if(!directionOptions||typeof directionOptions.reverse!=='boolean')throw Error('Reverse must be boolean');
 }
 const kinds=[1,2,4,24,25,26,6,7,9,17],before=new Map();
 const backup=path.join(backupRoot,'backlight-'+randomUUID());fs.mkdirSync(backup,{recursive:true});
 for(const k of kinds){const b=device.readInit(k);before.set(k,b);fs.writeFileSync(path.join(backup,`init-${k}.bin`),b,{flag:'wx'});}
 const raw=before.get(6),state=readBackLight(raw);
 if(!state.canSwitch)throw Error('Current effect cannot yet be safely restored. Select Normal or Stream in MMPanel first.');
 if((colorOptions!==undefined||speedOptions!==undefined||directionOptions!==undefined)&&state.mode!==mode)throw Error('Active effect changed. Refresh before applying settings.');
 const desired=Buffer.from(raw);desired[0]=mode;
 if(colorOptions!==undefined){const offset=8+(mode-2)*10;if(mode!==6)desired[offset+2]=Number(colorOptions.customRgb);Buffer.from(colorOptions.color.slice(1),'hex').copy(desired,offset+3);}
 if(speedOptions!==undefined)desired.writeUInt16LE(speedOptions.speed,14+(mode-2)*10);
 if(directionOptions!==undefined)desired[8+(mode-2)*10]=Number(directionOptions.reverse);
 const observations=[];
 function verify(wanted,label){
  const changes=[];
  for(const k of kinds){const actual=device.readInit(k),expected=k===6?wanted:before.get(k);
   fs.writeFileSync(path.join(backup,`${label}-${k}.bin`),actual);
   // M6UP mix_buttom occupies 218 bytes. Preserve unknown tail in evidence;
   // it varies on repeated reads and is not evidence of configuration damage.
   if(k===6)observations.push({label,tailHex:actual.subarray(218).toString('hex')});
   if(actual.length!==expected.length||!actual.subarray(0,k===6?218:actual.length).equals(expected.subarray(0,k===6?218:expected.length)))changes.push(k);
  }
  if(changes.length)throw Error('Readback mismatch in INIT'+changes.join(', INIT'));
 }
 try{device.send(encodeMode(desired,mode));verify(desired,'applied');}
 catch(error){
  try{device.send(encodeMode(raw,state.mode));verify(raw,'restored');}
  catch(restore){throw Error(`${error.message}; restoration unverified: ${restore.message}. Backup: ${backup}`);}
  throw Error(`${error.message}; original mode restored. Backup: ${backup}`);
 }finally{fs.writeFileSync(path.join(backup,'observations.json'),JSON.stringify({scope:'INIT6 first 218 bytes; other sections complete; unknown tail retained',observations},null,2));}
 return {...readBackLight(desired),verified:true,backup,persistence:'Pending Save to device memory and power-cycle verification'};
}
module.exports={readBackLight,encodeMode,applyBackLightMode};
