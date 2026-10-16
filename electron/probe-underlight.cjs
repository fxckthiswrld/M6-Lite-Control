'use strict';
const fs=require('node:fs'),{HeAdapter}=require('./he-adapter'),{readUnderLight,applyUnderLightMode}=require('./lighting-underlight');
const adapter=new HeAdapter('backups'),report={};
try{const original=adapter.transaction(d=>readUnderLight(d.readInit(9)));report.original=original;
 if(!original.canSwitch)throw Error('Cannot restore original Under Light mode');
 try{report.normal=adapter.transaction(d=>applyUnderLightMode(d,'backups',7));}
 finally{report.restored=adapter.transaction(d=>applyUnderLightMode(d,'backups',original.mode));}
 report.ok=true;
}catch(error){report.error=error.stack;process.exitCode=1;}
finally{fs.writeFileSync('lighting-underlight-verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
