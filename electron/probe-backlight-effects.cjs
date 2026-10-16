'use strict';
// Explicit diagnostic: backs up each transaction and restores the initial effect.
const fs=require('node:fs'),path=require('node:path'),{HeAdapter}=require('./he-adapter');
const a=new HeAdapter(path.resolve(__dirname,'../backups')),result={tests:[]};
try{
 const before=a.readBackLight();result.before=before;if(!before.canSwitch)throw Error('Current effect cannot be restored');
 try{for(const mode of [3,4,6,7]){result.tests.push(a.setBackLightMode(mode));fs.writeFileSync(path.resolve(__dirname,'../lighting-effects-verification.json'),JSON.stringify(result,null,2));}}
 finally{result.restore=a.setBackLightMode(before.mode);result.after=a.readBackLight();}
 result.ok=true;
}catch(error){result.ok=false;result.error=error.stack;process.exitCode=1;}
finally{fs.writeFileSync(path.resolve(__dirname,'../lighting-effects-verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));}
