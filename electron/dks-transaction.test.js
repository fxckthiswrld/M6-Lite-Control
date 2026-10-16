'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {HeAdapter}=require('./he-adapter');
function fixture(){
  const raw=Buffer.alloc(4776);
  for(let i=0;i<70;i++){const offset=8+i*68;raw[offset+9]=Math.floor(i/14)+1;raw[offset+10]=i%14;}
  return raw;
}
function run(action){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'m6-dks-test-'));try{action(new HeAdapter(dir));}finally{fs.rmSync(dir,{recursive:true});}}
test('DKS all expands only the 64 physical switches in the requested profile',()=>run(adapter=>{
  let captured;adapter.setDksBatch=(layer,requests)=>{captured={layer,requests};return 'done';};
  assert.equal(adapter.setDksAll({layer:1,target:'mouse:wheel-up',interval:25}),'done');
  assert.equal(captured.layer,1);assert.equal(captured.requests.length,64);
  assert.equal(new Set(captured.requests.map(k=>k.id)).size,64);
  assert.ok(captured.requests.every(k=>k.target==='mouse:wheel-up'&&k.interval===25&&k.enabled));
}));
test('DKS all preflights the entire keyboard before sending anything',()=>run(adapter=>{
  const raw=fixture();raw[8+69*68]=2;let sends=0;
  adapter.transaction=action=>action({withLayer:(_kind,_layer,fn)=>fn(),readInit:()=>raw,send:()=>sends++});
  assert.throws(()=>adapter.setDksAll({layer:0,target:'2:3',interval:20}),/Disable/);assert.equal(sends,0);
}));
test('DKS all verifies every physical assignment and leaves unused matrix cells unchanged',()=>run(adapter=>{
  const raw=fixture(),before=Buffer.from(raw),layout=require('./keyboard-layout.json');let sends=0;
  adapter.transaction=action=>action({withLayer:(_kind,_layer,fn)=>fn(),readInit:()=>Buffer.from(raw),send:b=>{
    sends++;const offset=8+(b[6]*14+b[7])*68;raw[offset]=b[8]&15;raw[offset+52]=b[9];raw[offset+53]=b[10];raw[offset+54]=b[11];b.copy(raw,offset+62,17,19);
  }});
  const result=adapter.setDksAll({layer:1,target:'2:3',interval:20});
  assert.equal(result.verified,true);assert.equal(sends,64);
  for(let i=0;i<70;i++){
    if(layout.some(k=>k.row*14+k.col===i)){assert.equal(result.keys[i].mode,4);assert.equal(result.keys[i].dks.row,3);assert.equal(result.keys[i].dks.col,3);}
    else assert.deepEqual(raw.subarray(8+i*68,8+(i+1)*68),before.subarray(8+i*68,8+(i+1)*68));
  }
}));
test('WASD preflight rejects a conflicting mode before sending any assignment',()=>run(adapter=>{
  const raw=fixture();raw[8+31*68]=5;let sends=0;
  adapter.transaction=action=>action({withLayer:(_kind,_layer,fn)=>fn(),readInit:()=>raw,send:()=>sends++});
  assert.throws(()=>adapter.setDksWasd({layer:0}),/Disable/);assert.equal(sends,0);
}));
test('partial WASD write failure restores every original assignment',()=>run(adapter=>{
  const original=fixture(),raw=Buffer.from(original);let sends=0;
  const device={withLayer:(_kind,_layer,fn)=>fn(),readInit:()=>Buffer.from(raw),send:b=>{
    if(++sends===2)throw new Error('Simulated USB failure');
    const offset=8+(b[6]*14+b[7])*68;raw[offset]=b[8]&15;
    const recordOffset=raw[offset]===4?52:8;
    raw[offset+recordOffset]=b[9];
    if(b[9]===0){raw[offset+recordOffset+1]=b[10];raw[offset+recordOffset+2]=b[11];}
    else{raw[offset+recordOffset+3]=b[10];b.copy(raw,offset+recordOffset+4,11,16);}
    b.copy(raw,offset+recordOffset+10,17,19);
  }};
  adapter.transaction=action=>action(device);
  assert.throws(()=>adapter.setDksWasd({layer:1}),/Original assignments restored/);
  assert.deepEqual(raw,original);
}));

test('disable accepts firmware cleanup only inside inactive DKS fields',()=>run(adapter=>{
  const raw=fixture(),offset=8+69*68;raw[offset]=4;raw[offset+52]=1;raw.writeInt16LE(8,offset+56);
  adapter.transaction=action=>action({withLayer:(_kind,_layer,fn)=>fn(),readInit:()=>Buffer.from(raw),send:b=>{
    raw[offset]=b[8]&15;
    if(raw[offset]===0){raw[offset+52]=0;raw.writeInt16LE(0,offset+56);}
  }});
  const reply=adapter.setDks({layer:0,id:'4:13',target:'mouse:right',interval:20,enabled:false});
  assert.equal(reply.keys[69].mode,0);assert.equal(reply.keys[69].dks.x,0);
}));

test('rollback completes later keys before retrying failed readback',()=>run(adapter=>{
  const original=fixture(),raw=Buffer.from(original);let sends=0,reads=0;
  adapter.transaction=action=>action({withLayer:(_kind,_layer,fn)=>fn(),readInit:()=>{
    reads++;
    if(reads===2||reads===3)throw new Error('Device read timed out');
    return Buffer.from(raw);
  },send:b=>{
    if(++sends===2)throw new Error('Write interrupted');
    const offset=8+(b[6]*14+b[7])*68;raw[offset]=b[8]&15;
    const field=raw[offset]===4?52:8;raw[offset+field]=b[9];
    if(b[9]===0){raw[offset+field+1]=b[10];raw[offset+field+2]=b[11];}
    else{raw[offset+field+3]=b[10];b.copy(raw,offset+field+4,11,16);}
    b.copy(raw,offset+field+10,17,19);
  }});
  assert.throws(()=>adapter.setDksWasd({layer:0}),/Original assignments restored/);
  assert.deepEqual(raw,original);assert.equal(reads,4);
  assert.equal(sends,14,'all twelve restoration commands were attempted');
}));

test('a failed restoration write does not skip remaining commands or keys',()=>run(adapter=>{
  const original=fixture();let sends=0;
  adapter.transaction=action=>action({withLayer:(_kind,_layer,fn)=>fn(),readInit:()=>Buffer.from(original),send:()=>{
    sends++;if(sends===2||sends===3)throw new Error('USB write failed');
  }});
  assert.throws(()=>adapter.setDksWasd({layer:0}),/Original assignments restored/);
  assert.equal(sends,14);
}));

test('rollback never reports success when verification remains unavailable',()=>run(adapter=>{
  const original=fixture();let sends=0,reads=0;
  adapter.transaction=action=>action({withLayer:(_kind,_layer,fn)=>fn(),readInit:()=>{
    if(++reads>1)throw new Error('Device read timed out');return Buffer.from(original);
  },send:()=>{if(++sends===2)throw new Error('USB write failed');}});
  assert.throws(()=>adapter.setDksWasd({layer:0}),/Restoration failed: Restoration could not be verified/);
  assert.equal(sends,14);assert.equal(reads,4);
}));
