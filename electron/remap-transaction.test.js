const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {HeAdapter}=require('./he-adapter');
for(const layer of [0,1])for(const fault of ['none','read','neighbor','partial-send'])test(`Remap M${layer+1}: ${fault}`,t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'m6-remap-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const adapter=new HeAdapter(dir),raw=Buffer.alloc(4776),off=8+29*68;
 raw[off+1]=2;raw[off+64]=2;raw[off+65]=1;const original=Buffer.from(raw);let sends=0;
 adapter.transaction=fn=>fn({withLayer:(type,l,action)=>{assert.equal(l,layer);return action();},readInit:kind=>{assert.equal(kind,layer===0?2:4);if(sends===1&&fault==='read')throw Error('Read failed');return Buffer.from(raw);},send:packet=>{
  sends++;assert.equal(packet[3],layer);raw[off]=packet[8]&15;raw[off+1]=packet[8]>>4;raw[off+64]=packet[10];raw[off+65]=packet[11];
  if(sends===1&&fault==='neighbor')raw[off+68+9]=7;
  if(sends===1&&fault==='partial-send')throw Error('Write failed after delivery');
 }});
 const run=()=>adapter.setRemap({layer,source:'2:1',target:'2:3'});
 if(fault==='none'){assert.equal(run().verified,true);assert.equal(sends,1);}
 else if(fault==='neighbor'){assert.throws(run,/Restoration failed/);assert.equal(sends,2);}
 else{assert.throws(run,/Original remap restored/);assert.deepEqual(raw,original);assert.equal(sends,2);}
 const backup=fs.readdirSync(dir).find(name=>name.endsWith('.bin'));assert.deepEqual(fs.readFileSync(path.join(dir,backup)),original);
});
