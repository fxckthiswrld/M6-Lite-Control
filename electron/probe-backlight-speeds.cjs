'use strict';
const fs=require('node:fs'),{HeAdapter}=require('./he-adapter');
const a=new HeAdapter('backups'),baseline='backups/lighting-full-a2f4229c-1dd5-4bf6-80df-6bf39f54d4d2',original=fs.readFileSync(baseline+'/init-6.bin'),report={baseline,tests:[]};
try{try{for(const mode of [3,4,6,7]){
 a.setBackLightMode(mode);const before=a.readBackLight(),test={before};report.tests.push(test);
 try{test.applied=a.setBackLightSpeed({mode,speed:before.speed+100});}
 finally{test.restored=a.setBackLightSpeed({mode,speed:before.speed});}
 fs.writeFileSync('lighting-speeds-verification.json',JSON.stringify(report,null,2));console.log(before.name+' speed verified and restored');
}}finally{report.restore=a.setBackLightMode(original[0]);}report.ok=true;}
catch(error){report.error=error.stack;process.exitCode=1;}
finally{fs.writeFileSync('lighting-speeds-verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,error:report.error}));}
