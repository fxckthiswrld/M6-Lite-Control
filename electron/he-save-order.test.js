'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {HeAdapter}=require('./he-adapter');
const {HeDevice}=require('./he-device');
const {parseHeProfile,fields}=require('./he-protocol');
const {cacheCrc}=require('./device-memory');
const inputMask=Buffer.from('6a6d64663f2ef0430a41ea8f2bfce0e7d5527ba5','hex');
const outputMask=Buffer.from('8e96ce6af272994858612758e89a7f0195eeed2f','hex');
function fixture(){
 const memory=new Map([1,2,4,24,25,26,6,7,9,17].map(kind=>[kind,Buffer.alloc(kind===2||kind===4?4776:kind===24?420:984)]));
 const flash=new Map(),queue=[],commands=[];let dirty=null,tag=null;
 const reply=p=>queue.push(Buffer.from([4,...Buffer.from(p).map((b,i)=>b^inputMask[i])]));
 const handle={close(){},readTimeout(){return queue.shift()??[];},write(report){
  const p=Buffer.from(report.slice(1).map((b,i)=>b^outputMask[i]));commands.push(p);
  if(p[0]!==8)throw Error('Unexpected command');
  if(p[1]===0){
   // A verification read filters out the pending unsolicited CRC request.
   const raw=memory.get(p[2]),total=raw.length/12;
   for(let sequence=1;sequence<=total;sequence++){
    const r=Buffer.alloc(20);r.set([8,0,p[2]]);r.writeUInt16LE(total,3);r.writeUInt16LE(sequence,5);raw.copy(r,8,(sequence-1)*12,sequence*12);reply(r);
   }
  }else if(p[1]===0x31){
   dirty=p[3];const raw=memory.get(25+dirty);
   const indices=p[2]===7?Array.from({length:70},(_,i)=>i):[p[4]*14+p[5]];
   for(const i of indices){raw[i*14]=p[6];p.copy(raw,i*14+2,7,19);}
   if(!queue.some(r=>(r[2]^inputMask[1])===0xc9+dirty)){const r=Buffer.alloc(20);r[1]=0xc9+dirty;reply(r);}
  }else if(p[1]===0xf2){
   if(dirty===null||!queue.length)throw Error('Pending CRC request was lost before DRIVER_ED');
  }else if(p[1]===0xc9||p[1]===0xca){
   tag=p.readUInt32LE(3);flash.set(25+dirty,Buffer.from(memory.get(25+dirty)));dirty=null;
   const r=Buffer.alloc(20);r[1]=0xfe;reply(r);
  }else throw Error('Unexpected command '+p[1]);
  return 21;
 }};
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'he-save-order-'));
 const adapter=new HeAdapter(dir,{saveDelayMs:0,saveSettleMs:0});
 adapter.transaction=fn=>fn(new HeDevice(handle));
 return {adapter,memory,flash,commands,get tag(){return tag;},cleanup:()=>fs.rmSync(dir,{recursive:true,force:true})};
}
test('single RT change reaches flash before any verification or backup reads',()=>{
 const f=fixture();try{
  const result=f.adapter.persistHeChange(d=>f.adapter.writeSelectedKey({id:'2:1',layer:0,rtOn:true,trigger:0.222},d));
  assert.equal(result.persistence.acknowledged,true);
  assert.equal(parseHeProfile(f.flash.get(25)).keys[29].trigger,111);
  assert.equal(f.tag,cacheCrc(f.memory.get(25).subarray(0,980)));
  const index=f.commands.findIndex(p=>p[1]===0x31);
  assert.deepEqual(f.commands.slice(index,index+4).map(p=>p[1]),[0x31,0xf2,0xc9,0]);
 }finally{f.cleanup();}
});
test('group batches and all-key writes commit before readback',()=>{
 for(const operation of ['group','all']){
  const f=fixture();try{
   const request={id:'2:1',layer:0,rtOn:true,...Object.fromEntries(fields.map(field=>[field,0.2]))};
   const result=f.adapter.persistHeChange(d=>operation==='all'?f.adapter.applyToAll(request,d):f.adapter.applyHePatch(0,Array.from({length:6},(_,col)=>({row:0,col,rtOn:1,trigger:100})), 'group',d));
   assert.equal(result.persistence.acknowledged,true);
   assert.deepEqual(f.flash.get(25),f.memory.get(25));
   assert.equal(f.commands.filter(p=>p[1]===0xf2).length,operation==='all'?1:2);
  }finally{f.cleanup();}
 }
});
