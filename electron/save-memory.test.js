'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {HeAdapter}=require('./he-adapter');
test('Save backs up all sections and requires a device SAVE_END response',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'m6-save-')),adapter=new HeAdapter(dir,{saveDelayMs:0,saveSettleMs:0}),sent=[];
 const mask=Buffer.from('6a6d64663f2ef0430a41ea8f2bfce0e7d5527ba5','hex');
 try{adapter.transaction=fn=>fn({readInit:k=>Buffer.alloc(k===2||k===4?4776:k===24?420:984),send:p=>sent.push(Buffer.from(p)),handle:{readTimeout:()=>sent.length?Buffer.from([4,...mask.map((b,i)=>b^(i===1?254:0))]):[]}});
  const result=adapter.saveToDeviceMemory();assert.equal(result.acknowledged,true);assert.equal(result.command,'DRIVER_ED');assert.deepEqual([...sent[0].subarray(0,2)],[8,242]);
  assert.deepEqual(fs.readdirSync(result.backup).sort(),['before-1.bin','before-17.bin','before-2.bin','before-24.bin','before-25.bin','before-26.bin','before-4.bin','before-6.bin','before-7.bin','before-9.bin','exchange.json']);
 }finally{fs.rmSync(dir,{recursive:true});}
});
test('Save does not send SAVE_END when a lighting backup fails',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'m6-save-')),adapter=new HeAdapter(dir,{saveDelayMs:0,saveSettleMs:0}),sent=[];
 try{
  adapter.transaction=fn=>fn({readInit:k=>{if(k===17)throw Error('Lighting read failed');return Buffer.alloc(24);},send:p=>sent.push(p)});
  assert.throws(()=>adapter.saveToDeviceMemory(),/Lighting read failed/);assert.equal(sent.length,0);
 }finally{fs.rmSync(dir,{recursive:true});}
});
