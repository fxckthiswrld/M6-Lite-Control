'use strict';
const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto'),{HeAdapter}=require('./he-adapter');
const backup=path.resolve(__dirname,'../backups/single-light-'+randomUUID()),report={backup};fs.mkdirSync(backup,{recursive:true});
try{new HeAdapter(backup).transaction(d=>{
 const kinds=[1,2,4,24,25,26,6,7,9,17],before=new Map();
 for(const k of kinds){const b=d.readInit(k);before.set(k,b);fs.writeFileSync(path.join(backup,`init-${k}.bin`),b);}
 const raw=before.get(7),offset=(1*6+2)*10;if(raw.length!==840||raw[offset+1]!==1)throw Error('Unexpected Single Light layout or mode');
 const original=Buffer.alloc(20);original.set([8,8,1,1,2]);raw.copy(original,5,offset,offset+6);
 const command=Buffer.from(original);command.set([1,1,255,51,102,153],5);
 const expected=Buffer.from(raw);command.copy(expected,offset,5,11);
 function verify(wanted,label){const errors=[];for(const k of kinds){const actual=d.readInit(k),target=k===7?wanted:before.get(k),n=k===6?218:target.length;fs.writeFileSync(path.join(backup,`${label}-${k}.bin`),actual);if(actual.length!==target.length||!actual.subarray(0,n).equals(target.subarray(0,n)))errors.push(k);}if(errors.length)throw Error('Mismatch INIT '+errors.join(','));}
 try{d.send(command);verify(expected,'applied');report.applied=true;}
 finally{d.send(original);verify(raw,'restored');report.restored=true;}
 });report.ok=true;
}catch(e){report.error=e.stack;process.exitCode=1;}
fs.writeFileSync(path.resolve(__dirname,'../lighting-single-probe.json'),JSON.stringify(report,null,2));console.log(report);
