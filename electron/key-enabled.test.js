const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {HeAdapter}=require('./he-adapter');
for(const layer of [0,1])for(const fault of ['none','read','neighbor','ignored','advanced'])test(`Key enabled M${layer+1}: ${fault}`,t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'m6-lock-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const a=new HeAdapter(dir),raw=Buffer.alloc(4776),offset=8+29*68;raw[offset+64]=3;raw[offset+65]=1;
 if(fault==='advanced')raw[offset]=1;
 const before=Buffer.from(raw);let sends=0;
 a.transaction=fn=>fn({withLayer:(_,actual,action)=>{assert.equal(actual,layer);return action();},
 readInit:kind=>{assert.equal(kind,layer?4:2);if(sends===1&&fault==='read')throw Error('Disconnected');return Buffer.from(raw);},
 send:command=>{if(sends===0)assert.deepEqual(fs.readFileSync(path.join(dir,fs.readdirSync(dir)[0])),before);sends++;if(fault!=='ignored'||sends!==1)raw[offset+1]=command[8]>>4;if(sends===1&&fault==='neighbor')raw[offset+68]=4;}});
 if(fault==='none'){
  const result=a.setKeyEnabled({layer,id:'2:1',enabled:false});assert.equal(result.verified,true);assert.equal(result.keys[29].locked,1);
  assert.equal(a.setKeyEnabled({layer,id:'2:1',enabled:false}).changed,false);assert.equal(sends,1);
  assert.equal(a.setKeyEnabled({layer,id:'2:1',enabled:true}).keys[29].locked,0);assert.deepEqual(raw,before);
 }else{
  assert.throws(()=>a.setKeyEnabled({layer,id:'2:1',enabled:false}),fault==='advanced'?/Unsupported assignment/:fault==='neighbor'?/Restoration failed/:/Original assignment restored/);
  assert.equal(sends,fault==='advanced'?0:2);
 }
});
for(const layer of [0,1])for(const mode of [2,3,4,5,6])for(const fail of [false,true])test(`Advanced lock M${layer+1} mode ${mode}, read failure ${fail}`,t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'m6-advanced-lock-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const a=new HeAdapter(dir),raw=Buffer.alloc(4776),offset=8+29*68;
 raw[offset]=mode;raw[offset+2]=1;raw[offset+3]=7;raw[offset+4]=2;raw[offset+53]=3;raw[offset+54]=3;raw[offset+62]=30;
 for(const field of [64,66]){raw[offset+field]=3;raw[offset+field+1]=3;}
 const original=Buffer.from(raw);let sends=0;
 a.transaction=fn=>fn({withLayer:(_,actual,action)=>{assert.equal(actual,layer);return action();},
 readInit:()=>{if(fail&&sends===1)throw Error('Read failed');return Buffer.from(raw);},
 send:command=>{sends++;assert.equal(command[8]&15,mode);if(mode===2){assert.equal(command[9],1);assert.equal(command[10],7);}else if(mode===3){assert.equal(command[9],2);}else{assert.equal(command[10],3);assert.equal(command[11],3);}if(mode===4)assert.equal(command.readUInt16LE(17),30);raw[offset+1]=command[8]>>4;}});
 if(fail){assert.throws(()=>a.setKeyEnabled({layer,id:'2:1',enabled:false}),/Original assignment restored/);assert.deepEqual(raw,original);}
 else{assert.equal(a.setKeyEnabled({layer,id:'2:1',enabled:false}).keys[29].locked,1);a.setKeyEnabled({layer,id:'2:1',enabled:true});assert.deepEqual(raw,original);}
 assert.equal(sends,2);
});
