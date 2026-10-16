'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {HeAdapter}=require('./he-adapter');
function fixture(mode){const raw=Buffer.alloc(4776);for(let i=0;i<70;i++){const o=8+i*68;for(const f of [9,64,66]){raw[o+f]=Math.floor(i/14)+1;raw[o+f+1]=i%14;}}
 if(mode)for(const [i,j] of [[29,31],[31,29]]){const o=8+i*68;raw[o]=mode;raw[o+(mode===5?65:67)]=j%14;}return raw;}
for(const layer of [0,1])for(const [oldMode,mode] of [[0,5],[0,6],[5,6],[6,5],[5,0],[6,0]]){
 test(`pair rollback M${layer+1} ${oldMode}->${mode} after partial write`,()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'m6-pair-'));try{
   const adapter=new HeAdapter(dir),before=fixture(oldMode),raw=Buffer.from(before);let sends=0,reads=0;
   adapter.transaction=fn=>fn({withLayer:(_k,_l,f)=>f(),readInit:kind=>{assert.equal(kind,layer?4:2);if(++reads===2)throw Error('Read timeout');return Buffer.from(raw);},send:b=>{
    if(++sends===2)throw Error('Partial write');
    const o=8+(b[6]*14+b[7])*68,m=b[8]&15;raw[o]=m;
    if(m===5||m===6){raw[o+(m===5?64:66)]=b[10];raw[o+(m===5?65:67)]=b[11];}
    else{raw[o+8]=b[9];if(!b[9]){raw[o+9]=b[10];raw[o+10]=b[11];}else{raw[o+11]=b[10];b.copy(raw,o+12,11,16);}b.copy(raw,o+17,16,19);}
   }});
   assert.throws(()=>adapter.setPair({layer,mode,first:'2:1',second:'2:3'}),/Original pair restored/);
   assert.deepEqual(raw,before);assert.equal(reads,3);
  }finally{fs.rmSync(dir,{recursive:true});}
 });
}
