'use strict';
const fs=require('node:fs'),{HeAdapter}=require('./he-adapter'),{EqDeviceSession}=require('./eq-device-session');
const session=new EqDeviceSession(new HeAdapter('backups'),'backups'),report={};
(async()=>{try{report.start=session.start();for(let i=0;i<14;i++){const levels=new Uint8Array(14);levels[i]=64;session.send(levels);await new Promise(r=>setTimeout(r,50));}session.send(new Uint8Array(14));report.ok=true;}
catch(error){report.ok=false;report.error=error.stack;}
finally{try{report.stop=session.stop();}catch(error){report.ok=false;report.restoreError=error.stack;}fs.writeFileSync('lighting-eq-device-verification.json',JSON.stringify(report,null,2));console.log(report);if(!report.ok)process.exitCode=1;}})();
