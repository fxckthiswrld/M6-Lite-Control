'use strict';
const fs=require('node:fs'),{HeAdapter}=require('./he-adapter'),a=new HeAdapter('backups'),report={tests:[]};
try{
 const original=a.readUnderLight();report.original=original;if(!original.canSwitch)throw Error('Cannot restore original Under Light mode');
 try{for(const mode of [7,3]){
  a.setUnderLightMode(mode);const before=a.readUnderLight(),result={before};report.tests.push(result);
  try{result.applied=a.setUnderLightColor({mode,customRgb:mode===3,color:'#336699'});}
  finally{result.restored=a.setUnderLightColor(before);}
  console.log(before.name+' color verified and restored');
 }}finally{report.restore=a.setUnderLightMode(original.mode);}
 report.ok=true;
}catch(error){report.error=error.stack;process.exitCode=1;}
finally{fs.writeFileSync('lighting-underlight-colors-verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,error:report.error}));}
