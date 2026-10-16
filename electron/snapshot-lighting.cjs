'use strict';
// Diagnostic read only; creates raw backups and explicitly provisional decoding.
const fs=require('node:fs'),path=require('node:path');
const {HeAdapter}=require('./he-adapter');
const {decodeBackLightCandidate,decodeUnderLightCandidate,decodeLightConfigCandidate}=require('./lighting-readback');
try{
 const snapshot=new HeAdapter(path.resolve(__dirname,'../backups')).readLightingSnapshot();
 const raw=kind=>Buffer.from(snapshot.sections.find(s=>s.kind===kind).hex,'hex');
 const report={snapshot:path.join(snapshot.backup,'snapshot.json'),verification:'static-layout-candidate',backLight:decodeBackLightCandidate(raw(6)),underLight:decodeUnderLightCandidate(raw(9)),lightConfig:decodeLightConfigCandidate(raw(17)),lightConfigHex:raw(17).toString('hex')};
 const output=path.join(snapshot.backup,'decoded-candidate.json');fs.writeFileSync(output,JSON.stringify(report,null,2),{flag:'wx'});
 console.log(JSON.stringify({backup:snapshot.backup,report:output,verification:report.verification},null,2));
}catch(error){console.error(error.message);process.exitCode=1;}
