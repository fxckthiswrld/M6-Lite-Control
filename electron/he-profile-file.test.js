'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {parseHeProfile}=require('./he-protocol');
const {exportProfile,validateProfile}=require('./he-profile-file');
const {HeAdapter}=require('./he-adapter');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
function document(){return exportProfile(parseHeProfile(Buffer.alloc(984)),0);}
test('HE JSON roundtrip exports 64 physical switches with exact travel units',()=>{
  const raw=Buffer.alloc(984);raw.writeUInt16LE(211,29*14+2);
  const saved=exportProfile(parseHeProfile(raw),1),keys=validateProfile(JSON.parse(JSON.stringify(saved)));
  assert.equal(keys.length,64);assert.equal(saved.sourceProfile,'M2');
  assert.equal(keys.find(k=>k.row===2&&k.col===1).head,211);
});
test('HE import rejects incompatible, incomplete, duplicate and invalid values',()=>{
  for(const mutate of [d=>d.version++,d=>d.productId++,d=>d.keys.pop(),d=>d.keys[1]=d.keys[0],d=>d.keys[0].head=0.001,d=>d.keys[0].bottom=3.4,d=>d.keys[0].rtOn=1]){
    const d=document();mutate(d);assert.throws(()=>validateProfile(d));
  }
});
test('invalid HE import does not access USB',()=>{
  const adapter=new HeAdapter('unused');adapter.transaction=()=>assert.fail('Unexpected USB access');
  assert.throws(()=>adapter.importHeProfile(0,{version:9}),/Incompatible/);
});
test('group validation rejects unknown and duplicate switches before USB access',()=>{
  const adapter=new HeAdapter('unused');adapter.transaction=()=>assert.fail('Unexpected USB access');
  for(const ids of [[],['2:1','2:1'],['9:9']])assert.throws(()=>adapter.writeSelectedKeys({layer:0,ids,rtOn:false,fixedDown:1,fixedUp:1}));
});
test('Mechanical group preserves individual RT settings and all unselected cells',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'m6-group-test-'));
  try{
    const adapter=new HeAdapter(dir),original=parseHeProfile(Buffer.alloc(984));
    original.keys.forEach((k,i)=>{k.head=i;k.rtOn=1;});let keys=structuredClone(original.keys),writes=0,reads=0;
    adapter.transaction=action=>action({withLayer:(_kind,_layer,fn)=>fn(),readProfile:()=>{reads++;return {raw:Buffer.alloc(984),keys:structuredClone(keys)};},writeKeyRaw:key=>{writes++;keys[key.row*14+key.col]={...key};}});
    adapter.writeSelectedKeys({layer:0,ids:['0:0','0:1','0:2','0:3','0:4'],rtOn:false,fixedDown:1.1,fixedUp:1.2});
    assert.equal(writes,5);assert.ok(reads>=4);
    for(let i=0;i<70;i++)assert.deepEqual(keys[i],i<5?{...original.keys[i],rtOn:0,fixedDown:550,fixedUp:600}:original.keys[i]);
  }finally{fs.rmSync(dir,{recursive:true});}
});
test('failed multi-key import restores original profile',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'m6-import-test-'));
  try{
    const adapter=new HeAdapter(dir),original=parseHeProfile(Buffer.alloc(984));let keys=structuredClone(original.keys),writes=0;
    adapter.transaction=action=>action({withLayer:(_kind,_layer,fn)=>fn(),readProfile:()=>({raw:Buffer.alloc(984),keys:structuredClone(keys)}),writeKeyRaw:key=>{
      if(++writes===2)throw new Error('Simulated disconnect');keys[key.row*14+key.col]={...key};
    }});
    const d=document();d.keys[0].head=0.2;d.keys[1].head=0.4;
    assert.throws(()=>adapter.importHeProfile(0,d),/Original HE profile restored/);
    assert.deepEqual(keys,original.keys);
  }finally{fs.rmSync(dir,{recursive:true});}
});
