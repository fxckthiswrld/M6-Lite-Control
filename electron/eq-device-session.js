'use strict';
const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const {encodeMode}=require('./lighting-backlight'),{encodeEqSpectrum}=require('./eq-spectrum');
const KINDS=[1,2,4,24,25,26,6,7,9,17];
function encodeEqMode(raw,{mainGain=70,groupGains=Array(8).fill(0)}={}){
 if(!Buffer.isBuffer(raw)||raw.length!==228)throw Error('Expected Back Light configuration');
 if(![1,2].includes(raw.readUInt16LE(6)))throw Error('Unsupported EQ spectrum style');
 if(!Number.isInteger(mainGain)||mainGain<0||mainGain>255||!Array.isArray(groupGains)||groupGains.length!==8||Array.from(groupGains).some(x=>!Number.isInteger(x)||x< -128||x>127))throw Error('Invalid EQ gains');
 const packet=Buffer.alloc(20);packet.set([8,5,1]);raw.copy(packet,4,4,8);packet[8]=raw[2];packet[9]=raw[3];packet[10]=mainGain;
 groupGains.forEach((gain,i)=>packet.writeInt8(gain,11+i));return packet;
}
class EqDeviceSession {
 constructor(adapter,root){this.adapter=adapter;this.root=root;this.state='idle';this.before=null;this.sent=0;}
 verify(device,eq,label){for(const kind of KINDS){const target=Buffer.from(this.before.get(kind));if(eq&&kind===6)target[0]=1;const raw=device.readInit(kind);fs.writeFileSync(path.join(this.backup,`${label}-${kind}.bin`),raw);const limit=kind===6?218:target.length;if(raw.length!==target.length||!raw.subarray(0,limit).equals(target.subarray(0,limit)))throw Error(`EQ verification mismatch INIT${kind}`);}}
 start(gains){
  if(this.state!=='idle')throw Error('EQ session is already active or needs recovery');
  this.sent=0;this.backup=path.join(this.root,'eq-session-'+randomUUID());fs.mkdirSync(this.backup,{recursive:true});this.before=new Map();
  return this.adapter.transaction(device=>{
   for(const kind of KINDS){const raw=device.readInit(kind);this.before.set(kind,raw);fs.writeFileSync(path.join(this.backup,`init-${kind}.bin`),raw,{flag:'wx'});}
   const raw=this.before.get(6);this.restoreCommand=encodeMode(raw,raw[0]);const command=encodeEqMode(raw,gains);
   this.state='starting';
   try{device.send(command);this.verify(device,true,'started');this.state='running';return {backup:this.backup,style:raw.readUInt16LE(6)};}
   catch(error){try{device.send(this.restoreCommand);this.verify(device,false,'rollback');this.state='idle';}catch(restore){this.state='recovery-required';throw Error(`${error.message}; restore failed: ${restore.message}. Backup: ${this.backup}`);}throw error;}
  });
 }
 send(levels){if(this.state!=='running')throw Error('EQ session is not running');const packet=encodeEqSpectrum(levels);this.adapter.transaction(device=>device.send(packet));this.sent++;}
 stop(){
  if(this.state==='idle')return {restored:true,changed:false};
  this.state='stopping';
  try{this.adapter.transaction(device=>{device.send(this.restoreCommand);this.verify(device,false,'restored');});this.state='idle';return {restored:true,sent:this.sent,backup:this.backup};}
  catch(error){this.state='recovery-required';throw error;}
 }
}
module.exports={EqDeviceSession,encodeEqMode};
