const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {HeAdapter}=require('./he-adapter');
for(const existingAssignment of [false,true])for(const type of ['Media','Layer'])for(const fault of ['none','read','neighbor'])test(`${type} existing=${existingAssignment}: ${fault} verifies full profile and restoration`,t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'m6-assignment-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const adapter=new HeAdapter(dir),before=Buffer.alloc(4776),offset=8+29*68;
 before[offset+2]=7;before[offset+3]=9;before[offset+4]=255;
 before[offset+9]=3;before[offset+10]=1;before[offset+17]=2;before[offset+18]=20;
 if(existingAssignment){before[offset]=type==='Media'?2:3;if(type==='Layer')before[offset+4]=1;before[offset+17]=0;before[offset+18]=0;}
 const raw=Buffer.from(before);let sends=0;
 adapter.transaction=fn=>fn({withLayer:(k,l,action)=>action(),readInit:()=>{if(sends===1&&fault==='read')throw Error('Read failed');return Buffer.from(raw);},send:b=>{
  sends++;assert.equal(fs.readdirSync(dir).length,1);raw[offset]=b[8]&15;
  if(raw[offset]===2){raw[offset+2]=b[9];raw[offset+3]=b[10];raw[offset+9]=b[6]+1;raw[offset+10]=b[7];raw[offset+17]=0;raw.writeUInt16LE(0,offset+18);}
  if(raw[offset]===3){raw[offset+4]=b[9];raw[offset+9]=b[6]+1;raw[offset+10]=b[7];raw[offset+17]=0;raw.writeUInt16LE(0,offset+18);}
  if(raw[offset]===0){raw[offset+8]=b[9];if(b[9]===0){raw[offset+9]=b[10];raw[offset+10]=b[11];}else{raw[offset+11]=b[10];b.copy(raw,offset+12,11,16);}raw[offset+17]=b[16];raw.writeUInt16LE(b.readUInt16LE(17),offset+18);}
  if(sends===1&&fault==='neighbor')raw[8+30*68+52]=1;
 }});
 const run=()=>type==='Media'?adapter.setMedia({layer:0,id:'2:1',index:2,data:4}):adapter.setLayerAssignment({layer:0,id:'2:1',targetLayer:2});
 if(fault==='none'){assert.equal(run().verified,true);assert.equal(sends,1);}
 else if(fault==='read'){assert.throws(run,/Original assignment restored/);assert.deepEqual(raw,before);assert.equal(sends,existingAssignment?2:4);}
 else assert.throws(run,/unrelated profile change.*Restoration failed/);
 assert.deepEqual(fs.readFileSync(path.join(dir,fs.readdirSync(dir)[0])),before);
});
for(const mode of [2,3])for(const fail of [false,true])test(`Return to standard mode${mode} failure=${fail}`,t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'m6-standard-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const adapter=new HeAdapter(dir),raw=Buffer.alloc(4776),off=8+29*68;raw[off]=mode;raw[off+2]=1;raw[off+3]=mode===2?2:0;raw[off+4]=mode===3?2:255;raw[off+9]=3;raw[off+10]=1;const original=Buffer.from(raw);let sends=0;
 adapter.transaction=fn=>fn({withLayer:(k,l,action)=>action(),readInit:()=>{if(fail&&sends===1)throw Error('Read failed');return Buffer.from(raw);},send:b=>{sends++;assert.equal(fs.readdirSync(dir).length,1);raw[off]=b[8]&15;if(raw[off]===0){raw[off+2]=1;raw[off+3]=0;raw[off+4]=255;}else{original.copy(raw,off+2,off+2,off+5);}}});
 if(fail){assert.throws(()=>adapter.returnToStandard({layer:0,id:'2:1'}),/Original assignment restored/);assert.deepEqual(raw,original);}
 else{assert.equal(adapter.returnToStandard({layer:0,id:'2:1'}).verified,true);assert.equal(raw[off],0);assert.deepEqual(raw.subarray(off+5),original.subarray(off+5));}
});
test('standard return controls follow selected key and busy state without modifying drafts',()=>{
 const vm=require('node:vm'),source=fs.readFileSync(require.resolve('./renderer.js'),'utf8'),elements={};
 const c=vm.createContext({busy:false,$:id=>elements[id]??(elements[id]={})});
 vm.runInContext(source.slice(source.indexOf('function standardReturnReason('),source.indexOf('function updateLayerState(')),c);
 const key={row:2,col:1,mode:2,modify:{type:0,row:3,col:1,mode:0,interval:0},layer:{layer:255},media:{index:1,data:1}};
 c.updateStandardReturn('media',key);assert.equal(elements['media-standard'].disabled,false);
 c.updateStandardReturn('media',{...key,mode:0});assert.equal(elements['media-standard'].disabled,true);assert.match(elements['media-standard-note'].textContent,/Media and FN/);
 c.updateStandardReturn('media',{...key,modify:{...key.modify,interval:20}});assert.equal(elements['media-standard'].disabled,true);assert.match(elements['media-standard-note'].textContent,/development/);
 c.busy=true;c.updateStandardReturn('media',key);assert.equal(elements['media-standard'].disabled,true);
 c.busy=false;c.updateStandardReturn('media',key);assert.equal(elements['media-standard'].disabled,false);
});

test('unsupported standard return does not write or create a backup',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'m6-preflight-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const adapter=new HeAdapter(dir);let sends=0;
 for(const variant of ['mode','modify','inactive']){
 const raw=Buffer.alloc(4776),o=8+29*68;raw[o]=variant==='mode'?4:2;raw[o+2]=1;raw[o+4]=variant==='inactive'?2:255;raw[o+9]=3;raw[o+10]=1;raw[o+18]=variant==='modify'?20:0;
 adapter.transaction=fn=>fn({withLayer:(k,l,a)=>a(),readInit:()=>raw,send:()=>sends++});
 assert.throws(()=>adapter.returnToStandard({layer:0,id:'2:1'}),/assignment|default/);
 }
 assert.equal(sends,0);assert.equal(fs.readdirSync(dir).length,0);
});
