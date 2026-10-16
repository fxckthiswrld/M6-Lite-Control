'use strict';
function validate(snapshot) {
  if(snapshot?.schema!==1||snapshot.device?.vendorId!==0x2233||snapshot.device?.productId!==0x006b)
    throw new Error('Expected an M6 Lite+ lighting snapshot');
  if(!Array.isArray(snapshot.sections)||snapshot.sections.length!==3)throw new Error('Incomplete lighting snapshot');
  const result=new Map();
  for(const section of snapshot.sections){
    if(![6,9,17].includes(section.kind)||result.has(section.kind))throw new Error('Unexpected or duplicate section');
    if(typeof section.hex!=='string'||! /^(?:[a-f0-9]{2})+$/i.test(section.hex)||section.hex.length!==section.bytes*2)throw new Error('Invalid section bytes');
    result.set(section.kind,Buffer.from(section.hex,'hex'));
  }
  return result;
}
function compareLightingSnapshots(before,after){
  const first=validate(before),second=validate(after);
  return {decoded:false,sections:[...first].map(([kind,a])=>{
    const b=second.get(kind),changes=[];
    for(let offset=0;offset<Math.max(a.length,b.length);offset++){
      if(a[offset]!==b[offset])changes.push({offset,before:a[offset]??null,after:b[offset]??null});
    }
    return {kind,beforeBytes:a.length,afterBytes:b.length,changed:changes.length>0,changes};
  })};
}
module.exports={compareLightingSnapshots};
if(require.main===module){
 const fs=require('node:fs');
 try{
  if(process.argv.length!==4)throw new Error('Usage: node lighting-snapshot-diff.js before/snapshot.json after/snapshot.json');
  console.log(JSON.stringify(compareLightingSnapshots(...process.argv.slice(2).map(p=>JSON.parse(fs.readFileSync(p,'utf8')))),null,2));
 }catch(error){console.error(error.message);process.exitCode=1;}
}
