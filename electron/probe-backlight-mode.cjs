'use strict';
// Controlled hardware experiment: reuses saved parameters and always restores mode.
const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const {HeAdapter}=require('./he-adapter');
const {encodeNormalCandidate,encodeStreamCandidate}=require('./lighting-command');
const root=path.resolve(__dirname,'../backups'),backup=path.join(root,'backlight-probe-'+randomUUID());fs.mkdirSync(backup,{recursive:true});
const report={backup,stages:[],tailInterpretation:'Unknown transfer tail; retained separately, not counted as configuration verification'};
try{new HeAdapter(root).transaction(d=>{
 const kinds=[1,2,4,24,25,26,6,9,17],before=new Map(kinds.map(k=>{const b=d.readInit(k);fs.writeFileSync(path.join(backup,`init-${k}.bin`),b);return [k,b];}));
 const raw=before.get(6);if(raw.length!==228||raw[0]!==5)throw Error('Probe requires current Stream mode');
 function payload(mode){const offset=mode===2?8:38,r=raw.subarray(offset,offset+10),options={mode,customRgb:!!r[2],color:'#'+r.subarray(3,6).toString('hex')};return mode===2?encodeNormalCandidate(Buffer.alloc(20),options):encodeStreamCandidate(Buffer.alloc(20),{...options,direction:!!r[0],speed:r.readUInt16LE(6)});}
 function verify(mode,label){const differences=[];for(const k of kinds){const actual=d.readInit(k),expected=Buffer.from(before.get(k));if(k===6)expected[0]=mode;fs.writeFileSync(path.join(backup,`${label}-${k}.bin`),actual);const limit=k===6?218:expected.length;for(let i=0;i<limit;i++)if(actual[i]!==expected[i])differences.push({kind:k,offset:i,expected:expected[i],actual:actual[i]});if(k===6)report.stages.push({label,mode:actual[0],tail:actual.subarray(218).toString('hex')});}if(differences.length)throw Error(JSON.stringify(differences));}
 try{const p=payload(2);fs.writeFileSync(path.join(backup,'normal-command.bin'),p);d.send(p);verify(2,'normal');}
 finally{const p=payload(5);fs.writeFileSync(path.join(backup,'restore-command.bin'),p);d.send(p);verify(5,'restore');report.restoredKnownConfiguration=true;}
 report.ok=true;
});}catch(e){report.ok=false;report.error=e.stack;process.exitCode=1;}
finally{fs.writeFileSync(path.resolve(__dirname,'../lighting-mode-adapter-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
