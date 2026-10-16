'use strict';
const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const modes={3:{name:'Breath',offset:2},4:{name:'Gradient',offset:10},5:{name:'Stream',offset:18},6:{name:'Star',offset:26},7:{name:'Normal',offset:50}};
const speedRanges={3:[1500,3000],4:[5000,20000],5:[2000,6000],6:[2000,4000]};
function readUnderLight(raw){
 if(!Buffer.isBuffer(raw)||raw.length!==108)throw Error('Expected 108-byte Under Light section');
 const mode=raw[0],canEditColor=[3,7].includes(mode),offset=modes[mode]?.offset;
 return {mode,name:modes[mode]?.name||'Unknown',canSwitch:!!modes[mode],supportedModes:Object.keys(modes).map(Number),canEditColor,supportsCustomRgb:mode===3,
  canEditSpeed:!!speedRanges[mode],...(speedRanges[mode]?{speed:raw.readUInt16LE(offset+4),speedMinimum:speedRanges[mode][0],speedMaximum:speedRanges[mode][1]}:{}),
  ...(canEditColor?{customRgb:raw[offset]===1,color:'#'+raw.subarray(offset+1,offset+4).toString('hex').toUpperCase()}: {})};
}
function encodeUnderLightMode(raw,mode){
 readUnderLight(raw);if(!modes[mode])throw Error('Unsupported Under Light mode');
 const record=raw.subarray(modes[mode].offset,modes[mode].offset+8),payload=Buffer.alloc(20);payload.set([8,11,0,mode]);
 if(mode!==7)record.copy(payload,4,4,6);
 if([3,7].includes(mode)){payload[8]=record[0];record.copy(payload,9,1,4);}
 return payload;
}
function applyUnderLightMode(device,backupRoot,mode,colorOptions,speedOptions){
 if(!Number.isInteger(mode)||!modes[mode])throw Error('Unsupported Under Light mode');
 if(colorOptions!==undefined){
  if(![3,7].includes(mode))throw Error('Under Light custom color is available for Normal and Breath only');
  if(!colorOptions||typeof colorOptions.customRgb!=='boolean'||typeof colorOptions.color!=='string'||!/^#[0-9a-f]{6}$/i.test(colorOptions.color))throw Error('Expected customRgb boolean and #RRGGBB color');
  if(mode===7&&colorOptions.customRgb)throw Error('Under Light Normal uses direct color without Custom RGB');
 }
 if(speedOptions!==undefined){
  if(!speedRanges[mode])throw Error('This Under Light effect has no speed control');
  const [min,max]=speedRanges[mode];
  if(!speedOptions||!Number.isInteger(speedOptions.speed)||speedOptions.speed<min||speedOptions.speed>max)throw Error(`Under Light speed must be an integer from ${min} to ${max}`);
 }
 const backup=path.join(backupRoot,'underlight-'+randomUUID());fs.mkdirSync(backup,{recursive:true});
 const kinds=[1,2,4,24,25,26,6,7,9,17],before=new Map();
 for(const k of kinds){const b=device.readInit(k);before.set(k,b);fs.writeFileSync(path.join(backup,`init-${k}.bin`),b,{flag:'wx'});}
 if(before.get(17)[11]!==0)throw Error('Disable Normal Sync and refresh before editing Under Light effects');
 const original=before.get(9),state=readUnderLight(original);
 if(!state.canSwitch)throw Error('Current Under Light effect cannot yet be restored safely');
 if((colorOptions!==undefined||speedOptions!==undefined)&&mode!==state.mode)throw Error('Active Under Light effect changed. Refresh before applying settings.');
 const expected=Buffer.from(original);expected[0]=mode;
 if(colorOptions!==undefined){const offset=modes[mode].offset;if(mode===3)expected[offset]=Number(colorOptions.customRgb);Buffer.from(colorOptions.color.slice(1),'hex').copy(expected,offset+1);}
 if(speedOptions!==undefined)expected.writeUInt16LE(speedOptions.speed,modes[mode].offset+4);
 function verify(wanted,label){
  const mismatches=[];
  for(const k of kinds){const actual=device.readInit(k),target=k===9?wanted:before.get(k),limit=k===6?218:target.length;
   fs.writeFileSync(path.join(backup,`${label}-${k}.bin`),actual);
   if(actual.length!==target.length||!actual.subarray(0,limit).equals(target.subarray(0,limit)))mismatches.push(k);
  }
  if(mismatches.length)throw Error('Readback mismatch in INIT'+mismatches.join(', INIT'));
 }
 try{device.send(encodeUnderLightMode(expected,mode));verify(expected,'applied');}
 catch(error){
  try{device.send(encodeUnderLightMode(original,state.mode));verify(original,'restored');}
  catch(restore){throw Error(`${error.message}; restoration unverified: ${restore.message}. Backup: ${backup}`);}
  throw Error(`${error.message}; original Under Light mode restored. Backup: ${backup}`);
 }
 return {...readUnderLight(expected),verified:true,backup,persistence:'Pending Save to device memory and power-cycle verification'};
}
module.exports={readUnderLight,encodeUnderLightMode,applyUnderLightMode};
