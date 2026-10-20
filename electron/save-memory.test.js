'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {HeAdapter}=require('./he-adapter');
test('Save to device memory backs up all sections and sends SAVE_END once',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'m6-save-')),adapter=new HeAdapter(dir,{saveDelayMs:0}),sent=[];
 try{adapter.transaction=fn=>fn({readInit:k=>Buffer.alloc(k===2||k===4?4776:k===24?420:984),send:p=>sent.push(Buffer.from(p))});
  const result=adapter.saveToDeviceMemory();assert.equal(result.acknowledged,true);assert.equal(result.command,'SAVE_END');assert.deepEqual([...sent[0].subarray(0,2)],[8,242]);
  assert.deepEqual(fs.readdirSync(result.backup).sort(),['before-1.bin','before-17.bin','before-2.bin','before-24.bin','before-25.bin','before-26.bin','before-4.bin','before-6.bin','before-7.bin','before-9.bin','save-command.bin']);
 }finally{fs.rmSync(dir,{recursive:true});}
});
test('Save does not send SAVE_END when a lighting backup fails',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'m6-save-')),adapter=new HeAdapter(dir,{saveDelayMs:0}),sent=[];
 try{
  adapter.transaction=fn=>fn({readInit:k=>{if(k===17)throw Error('Lighting read failed');return Buffer.alloc(24);},send:p=>sent.push(p)});
  assert.throws(()=>adapter.saveToDeviceMemory(),/Lighting read failed/);assert.equal(sent.length,0);
 }finally{fs.rmSync(dir,{recursive:true});}
});
