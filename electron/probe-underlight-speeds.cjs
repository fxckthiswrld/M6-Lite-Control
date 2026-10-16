'use strict';
const fs=require('node:fs'),{HeAdapter}=require('./he-adapter'),a=new HeAdapter('backups'),report={tests:[]};
try{
 const original=a.readUnderLight();report.original=original;if(!original.canSwitch)throw Error('Cannot restore original Under Light mode');
 try{for(const mode of [3,4,5,6]){
  a.setUnderLightMode(mode);const before=a.readUnderLight(),result={before};report.tests.push(result);
  try{result.applied=a.setUnderLightSpeed({mode,speed:before.speed+100});}
  finally{result.restored=a.setUnderLightSpeed({mode,speed:before.speed});}
  fs.writeFileSync('lighting-underlight-speeds-verification.json',JSON.stringify(report,null,2));console.log(before.name+' speed verified and restored');
 }}finally{report.restore=a.setUnderLightMode(original.mode);}
 report.ok=true;
}catch(error){report.error=error.stack;process.exitCode=1;}
finally{fs.writeFileSync('lighting-underlight-speeds-verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,error:report.error}));}
