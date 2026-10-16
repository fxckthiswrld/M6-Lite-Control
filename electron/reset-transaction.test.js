const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {HeAdapter}=require('./he-adapter');
for(const layer of [0,1])for(const fault of ['none','neighbor','read','mode','lock'])test(`Reset M${layer+1}: ${fault}`,t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'m6-reset-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const adapter=new HeAdapter(dir),raw=Buffer.alloc(4776),offset=8+29*68;raw[offset]=2;raw[offset+1]=1;
 const before=Buffer.from(raw);let sent=false;
 adapter.transaction=fn=>fn({withLayer:(type,actual,action)=>{assert.equal(type,'programming');assert.equal(actual,layer);return action();},readInit:kind=>{assert.equal(kind,layer===0?2:4);if(sent&&fault==='read')throw Error('Disconnected');return Buffer.from(raw);},send:()=>{assert.deepEqual(fs.readFileSync(path.join(dir,fs.readdirSync(dir)[0])),before);sent=true;if(fault!=='lock')raw[offset+1]=0;if(fault!=='mode')raw[offset]=0;if(fault==='neighbor')raw[offset+68+9]=7;}});
 if(fault==='none')assert.equal(adapter.resetProgrammingKey({layer,id:'2:1'}).verified,true);
 else assert.throws(()=>adapter.resetProgrammingKey({layer,id:'2:1'}),fault==='neighbor'?/unrelated key.*Reset not verified/:/Reset not verified/);
 assert.equal(sent,true);
});
for(const layer of [0,1])for(const mode of [0,5,6])test(`Reset M${layer+1}: reports remaining partner mode ${mode}`,t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'m6-reset-pair-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const adapter=new HeAdapter(dir),raw=Buffer.alloc(4776),source=8+29*68,partner=8+31*68;
 raw[source]=mode;raw[partner]=mode;
 const field=mode===6?66:64;raw[partner+field]=3;raw[partner+field+1]=1;
 const originalPartner=Buffer.from(raw.subarray(partner,partner+68));
 adapter.transaction=fn=>fn({withLayer:(_,actual,action)=>{assert.equal(actual,layer);return action();},readInit:()=>Buffer.from(raw),send:()=>{raw[source]=0;}});
 const result=adapter.resetProgrammingKey({layer,id:'2:1'});
 assert.deepEqual(result.remainingPairSources,mode===0?[]:[{id:'2:3',mode}]);
 assert.deepEqual(raw.subarray(partner,partner+68),originalPartner);
});
