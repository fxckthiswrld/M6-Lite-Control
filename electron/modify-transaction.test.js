'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {HeAdapter}=require('./he-adapter');
function setup(t,corrupt=false,normalizeMouse=false){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'m6-modify-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const adapter=new HeAdapter(dir),original=Buffer.alloc(4776);
 let raw=Buffer.from(original),sends=0;
 adapter.transaction=fn=>fn({withLayer:(kind,layer,action)=>action(),readInit:()=>Buffer.from(raw),send:command=>{
   sends++;
   assert.equal(fs.readdirSync(dir).length,1,'backup must precede write');
   const offset=8+(command[6]*14+command[7])*68;
   raw[offset+8]=command[9];
   if(command[9]===0){raw[offset+9]=command[10];raw[offset+10]=command[11];}
   else {raw[offset+11]=command[10];command.copy(raw,offset+12,11,16);}
   if(command[9]===1&&normalizeMouse){raw[offset+9]=command[6]+1;raw[offset+10]=command[7];}
   raw[offset+17]=command[16];raw.writeUInt16LE(command.readUInt16LE(17),offset+18);
   if(corrupt&&sends===1)raw[8+30*68+52]=1;
 }});
 return {adapter,dir,sends:()=>sends,original};
}
test('Modify verifies keyboard repeat fields and retains an exact pre-write backup',t=>{
 const h=setup(t);
 const result=h.adapter.setModify({layer:0,id:'2:1',modify:{type:0,row:3,col:4,mode:2,interval:513}});
 assert.equal(result.verified,true);assert.equal(h.sends(),1);
 assert.equal(result.keys[29].modify.interval,513);assert.equal(result.keys[29].modify.mode,2);
 assert.deepEqual(fs.readFileSync(result.backup),h.original);
});
test('Modify detects neighboring-key damage and never claims rollback succeeded',t=>{
 const h=setup(t,true);
 assert.throws(()=>h.adapter.setModify({layer:0,id:'2:1',modify:{type:0,row:3,col:4,mode:2,interval:513}}),/changed another key.*Restoration failed/);
 assert.equal(h.sends(),3);
 assert.deepEqual(fs.readFileSync(path.join(h.dir,fs.readdirSync(h.dir)[0])),h.original);
});
test('invalid interval is rejected before a write or backup',t=>{
 const h=setup(t);
 assert.throws(()=>h.adapter.setModify({layer:0,id:'2:1',modify:{type:0,row:3,col:4,interval:-1}}),/interval/);
 assert.equal(h.sends(),0);assert.equal(fs.readdirSync(h.dir).length,0);
});
test('mouse Modify verifies negative wheel and movement without unsigned mismatch',t=>{
 const h=setup(t);
 const result=h.adapter.setModify({layer:0,id:'2:1',modify:{type:1,button:0,x:-8,y:8,wheel:-1,mode:2,interval:20}});
 assert.equal(result.verified,true);assert.equal(h.sends(),1);
 assert.equal(result.keys[29].modify.wheel,-1);assert.equal(result.keys[29].modify.x,-8);
 assert.deepEqual(fs.readFileSync(result.backup),h.original);
});
test('observed mouse conversion may normalize the inactive target to the source key',t=>{
 const h=setup(t,false,true);
 const result=h.adapter.setModify({layer:0,id:'2:1',modify:{type:1,button:0,x:0,y:0,wheel:-1,mode:0,interval:20}});
 assert.equal(result.verified,true);assert.equal(result.keys[29].modify.row,3);
 assert.equal(result.keys[29].modify.col,1);
});
test('failed type change restores both active and inactive fields byte for byte',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'m6-modify-recovery-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 for(const originalType of [0,1]){
   const adapter=new HeAdapter(dir),before=Buffer.alloc(4776),offset=8+29*68;
   before[offset+8]=originalType;before[offset+9]=3;before[offset+10]=4;
   before[offset+11]=2;before.writeInt16LE(-8,offset+12);before.writeInt16LE(16,offset+14);
   before[offset+16]=255;before[offset+17]=2;before.writeUInt16LE(513,offset+18);
   const raw=Buffer.from(before);let sends=0;
   adapter.transaction=fn=>fn({withLayer:(k,l,action)=>action(),readInit:()=>{
     if(sends===1)throw Error('Simulated disconnect after write');
     return Buffer.from(raw);
   },send:packet=>{
     sends++;raw[offset+8]=packet[9];
     if(packet[9]===0){raw[offset+9]=packet[10];raw[offset+10]=packet[11];}
     else{raw[offset+11]=packet[10];packet.copy(raw,offset+12,11,16);}
     raw[offset+17]=packet[16];raw.writeUInt16LE(packet.readUInt16LE(17),offset+18);
   }});
   const modify=originalType===0?{type:1,button:4,x:32,y:-32,wheel:1,mode:0,interval:20}:{type:0,row:1,col:2,mode:0,interval:20};
   assert.throws(()=>adapter.setModify({layer:0,id:'2:1',modify}),/Original assignment restored/);
   assert.equal(sends,3);assert.deepEqual(raw,before);
 }
});
