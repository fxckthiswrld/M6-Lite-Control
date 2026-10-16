'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {preparePresetOff,prepareQuickPreset}=require('./preset-off'),{HeAdapter}=require('./he-adapter');
const native=name=>fs.readFileSync(path.join(__dirname,'fixtures',`native-m2-${name}.bin`));
for(const [before,preset,after,command] of [['standard','dks','dks',9],['dks','snap','dks-to-snap',11],['dks-to-snap','dks','snap-to-dks',9]]){
  test(`native preset ${before} -> ${preset} matches recorded hardware transfer`,()=>{
    const plan=prepareQuickPreset(native(before),1,preset);
    assert.deepEqual(plan.expected,native(after));assert.equal(plan.command[2],command);
  });
}
test('SNAP preserves W/S DKS while DKS resets A/D Snap partner fields',()=>{
  const snap=prepareQuickPreset(native('dks'),1,'snap').expected;
  for(const i of [16,30])assert.equal(snap[8+i*68],4);
  for(const i of [29,31])assert.equal(snap[8+i*68],5);
  const dks=prepareQuickPreset(snap,1,'dks').expected;
  for(const i of [16,29,30,31]){assert.equal(dks[8+i*68],4);assert.equal(dks[8+i*68+65],i%14);}
});
test('quick preset rejects unknown operation before opening USB',()=>{
  const adapter=new HeAdapter('unused');adapter.transaction=()=>assert.fail('Unexpected USB access');
  assert.throws(()=>adapter.setQuickPreset({layer:0,preset:'unknown'}),/Select DKS/);
});
const fixture=()=>fs.readFileSync(path.join(__dirname,'fixtures','preset-off-snap-before.bin'));
for(const type of ['snap','dks'])test(`M2 native Off matches captured ${type} transfer`,()=>{
  const raw=fs.readFileSync(path.join(__dirname,'fixtures',`preset-off-m2-${type}-before.bin`));
  assert.deepEqual(preparePresetOff(raw,1).expected,fs.readFileSync(path.join(__dirname,'fixtures',`preset-off-m2-${type}-after.bin`)));
});
test('native Off matches captured DKS result and preserves custom F',()=>{
  const raw=fs.readFileSync(path.join(__dirname,'fixtures','preset-off-dks-before.bin'));
  assert.deepEqual(preparePresetOff(raw,0).expected,fs.readFileSync(path.join(__dirname,'fixtures','preset-off-dks-after.bin')));
});
test('native Off matches captured SNAP result and preserves custom F/G',()=>{
  const raw=fixture(),plan=preparePresetOff(raw,0);
  assert.deepEqual(plan.expected,fs.readFileSync(path.join(__dirname,'fixtures','preset-off-snap-after.bin')));
  assert.deepEqual([...plan.command.subarray(0,4)],[8,3,10,0]);assert.equal(plan.changed,true);
  assert.deepEqual(plan.expected.subarray(2184,2320),raw.subarray(2184,2320));
});
test('Off rejects unsupported profile and custom or cross-boundary assignments',()=>{
  assert.throws(()=>preparePresetOff(fixture(),2),/M1 or M2/);
  for(const [offset,value] of [[8+16*68,2],[8+29*68+65,4],[8+32*68+65,1],[8+16*68+1,1]]){
    const raw=fixture();raw[offset]=value;assert.throws(()=>preparePresetOff(raw,0),/custom|Custom/);
  }
});
test('M2 Off selects M2 for reads and restoration while native command keeps byte3 zero',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'m6-off-m2-'));
  try{
    const raw=fixture(),plan=preparePresetOff(raw,1),adapter=new HeAdapter(dir);let sent=0,reads=0;
    assert.equal(plan.command[3],0);assert.ok(plan.restore.every(b=>b[3]===1));
    adapter.transaction=fn=>fn({withLayer:(kind,layer,f)=>{assert.equal(kind,'programming');assert.equal(layer,1);return f();},
      readInit:kind=>{assert.equal(kind,4);reads++;return Buffer.from(sent?plan.expected:raw);},
      send:b=>{assert.deepEqual(b,plan.command);sent++;}});
    assert.equal(adapter.presetOff({layer:1}).verified,true);assert.equal(sent,1);assert.equal(reads,2);
  }finally{fs.rmSync(dir,{recursive:true});}
});
test('Off verifies all bytes and backs up before sending',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'m6-off-'));
  try{
    const adapter=new HeAdapter(dir);let raw=fixture(),sends=0;
    const expected=preparePresetOff(raw,0).expected;
    adapter.transaction=fn=>fn({withLayer:(_k,_l,f)=>f(),readInit:()=>Buffer.from(raw),send:()=>{
      assert.equal(fs.readdirSync(dir).length,1);sends++;raw=expected;
    }});
    assert.equal(adapter.presetOff({layer:0}).verified,true);assert.equal(sends,1);
    assert.equal(adapter.presetOff({layer:0}).changed,false);assert.equal(sends,1);
  }finally{fs.rmSync(dir,{recursive:true});}
});
test('Off preflight rejects a cross-boundary pair without writes',()=>{
  const adapter=new HeAdapter('unused'),raw=fixture();raw[8+32*68+65]=1;let sends=0;
  adapter.transaction=fn=>fn({withLayer:(_k,_l,f)=>f(),readInit:()=>raw,send:()=>sends++});
  assert.throws(()=>adapter.presetOff({layer:0}),/custom pair/);assert.equal(sends,0);
});
test('Off exhausts read retries then attempts every restoration command',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'m6-off-failure-'));
  try{
    const adapter=new HeAdapter(dir),raw=fixture(),plan=preparePresetOff(raw,0);let reads=0,sends=0;
    adapter.transaction=fn=>fn({withLayer:(_k,_l,f)=>f(),readInit:()=>{
      if(++reads>1)throw new Error('Device read timed out');return Buffer.from(raw);
    },send:()=>{if(++sends===2)throw new Error('Restore write failed');}});
    assert.throws(()=>adapter.presetOff({layer:0}),/Restoration could not be verified/);
    assert.equal(sends,1+plan.restore.length);assert.equal(reads,7);
  }finally{fs.rmSync(dir,{recursive:true});}
});
