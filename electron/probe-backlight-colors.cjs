'use strict';
const fs=require('node:fs'),path=require('node:path'),{HeAdapter}=require('./he-adapter');
const a=new HeAdapter(path.resolve(__dirname,'../backups')),report={tests:[]},output=path.resolve(__dirname,'../lighting-colors-verification.json');
try{
 const original=a.readBackLight();report.original=original;if(!original.canSwitch)throw Error('Unsupported initial effect');
 try{for(const mode of (process.argv.length>2?process.argv.slice(2).map(Number):[2,3,6,7])){
  a.setBackLightMode(mode);const before=a.readBackLight(),test={before};report.tests.push(test);
  try{test.applied=a.setBackLightColor({mode,customRgb:mode!==6,color:'#336699'});}
  finally{test.restored=a.setBackLightColor(before);}
  fs.writeFileSync(output,JSON.stringify(report,null,2));console.log(`${before.name}: color applied and restored`);
 }}finally{report.restore=a.setBackLightMode(original.mode);}
 report.ok=true;
}catch(error){report.ok=false;report.error=error.stack;process.exitCode=1;}
finally{fs.writeFileSync(output,JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,error:report.error}));}
