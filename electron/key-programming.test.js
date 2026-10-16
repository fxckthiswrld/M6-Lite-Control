'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {parseProgrammingProfile,parseMacroKey,encodePair,encodeModRestore,encodeStandardRemap,encodeHotKey,countMacroSteps}=require('./key-programming');
test('parses managed prog_key metadata from a key record',()=>{const b=Buffer.alloc(68);b.writeUInt16LE(3,20);b[22]=1;b[23]=1;b.writeUInt16LE(40,24);b[26]=7;b[27]=8;b.writeUInt32LE(0x11223344,28);assert.deepEqual(parseMacroKey(b),{steps:3,isRoll:1,isCombo:1,rollDelay:40,reserved:[7,8],packed:[0x11223344,0,0,0,0,0]});});
test('standard remap command preserves source and lock fields',()=>{
 const b=encodeStandardRemap({row:2,col:1,locked:1},1,258,{row:1,col:3});
 assert.deepEqual([...b.subarray(0,12)],[8,3,1,1,2,1,2,1,16,0,1,3]);
});
test('pair command preserves lock, macro count and one-based partner row',()=>{
  assert.equal(encodePair({row:2,col:1,locked:1},1,258,5,{row:3,col:3}).toString('hex'),'0803010102010201150003030000000000000000');
  assert.throws(()=>encodePair({row:2,col:1,locked:0},0,0,5,{row:0,col:3}),/1-based/);
});
test('programming reader excludes transfer padding and counts only active macros',()=>{
  const raw=Buffer.alloc(4776);raw.writeUInt32LE(23,4);
  raw[8]=1;raw.writeUInt16LE(23,28);raw.writeUInt16LE(900,96);
  raw[8+29*68+64]=3;raw[8+29*68+65]=3;
  const profile=parseProgrammingProfile(raw);
  assert.equal(profile.keys.length,70);assert.equal(countMacroSteps(profile.keys),23);
  assert.deepEqual(profile.keys[29].snap,{row:3,col:3});
  assert.throws(()=>parseProgrammingProfile(raw.subarray(0,4768)),/complete/);
});
test('reads the confirmed standard HotKey interval field',()=>{
  const raw=Buffer.alloc(4776),offset=8+29*68;
  raw[offset+17]=2;raw[offset+18]=20;
  const key=parseProgrammingProfile(raw).keys[29];
  assert.deepEqual(key.hotKey,{type:2,interval:20});
});
test('parses the confirmed key_t media, layer and modify regions',()=>{
  const raw=Buffer.alloc(4776),offset=8+29*68;raw[offset+2]=7;raw[offset+3]=42;raw[offset+4]=1;raw[offset+8]=0;raw[offset+9]=3;raw[offset+10]=1;raw[offset+12]=0xf0;raw[offset+13]=0xff;raw[offset+17]=2;raw.writeUInt16LE(20,offset+18);
  const key=parseProgrammingProfile(raw).keys[29];
  assert.deepEqual(key.media,{index:7,data:42});assert.equal(key.layer.layer,1);assert.equal(key.modify.row,3);assert.equal(key.modify.col,1);assert.equal(key.modify.x,-16);assert.equal(key.hotKey.interval,20);
});
test('encodes the observed HotKey command fields',()=>{
  const b=encodeHotKey({row:2,col:1,locked:0},0,0,20);
  assert.equal(b[16],2);assert.equal(b[17],20);
  assert.equal(b[6],2);assert.equal(b[7],1);
});
test('encodes media mode and its confirmed two-byte payload',()=>{
 const b=require('./key-programming').encodeMedia({row:2,col:1,locked:1},0,23,7,42);
 assert.deepEqual([...b.subarray(0,12)],[8,3,1,0,23,0,2,1,18,7,42,0]);
});
  test('encodes keyboard and mouse fields from recovered QC64 SendModData',()=>{
 const {encodeModify}=require('./key-programming');
 const keyboard=encodeModify({row:2,col:1,locked:0},0,0,{type:0,row:3,col:4});assert.deepEqual([...keyboard.subarray(9,13)],[0,3,4,0]);
 const mouse=encodeModify({row:2,col:1,locked:0},0,0,{type:1,button:2,x:-16,y:8,wheel:1,mode:3,interval:20});assert.equal(mouse[9],1);assert.equal(mouse[10],2);assert.equal(mouse.readInt16LE(11),-16);assert.equal(mouse.readInt16LE(13),8);assert.equal(mouse[15],1);assert.equal(mouse[16],3);assert.equal(mouse.readUInt16LE(17),20);
});
  test('keyboard Modify retains mode and 16-bit interval, rejecting invalid values',()=>{
    const {encodeModify}=require('./key-programming');
    const key={row:2,col:1,locked:0},modify={type:0,row:3,col:4,mode:3,interval:513};
    const command=encodeModify(key,0,0,modify);
    assert.equal(command[16],3);assert.equal(command.readUInt16LE(17),513);
    for(const interval of [-1,65536,1.5,NaN])assert.throws(()=>encodeModify(key,0,0,{...modify,interval}),/interval/);
    assert.throws(()=>encodeModify(key,0,0,{...modify,mode:256}),/mode/);
  });
  test('mouse Modify uses signed wheel semantics with vendor byte 255 for down',()=>{
    const {encodeModify,parseProgrammingProfile}=require('./key-programming');
    const key={row:2,col:1,locked:0};
    const mouse={type:1,button:0,x:-8,y:8,wheel:-1,mode:2,interval:20};
    const packet=encodeModify(key,0,0,mouse);
    assert.equal(packet[15],255);assert.equal(packet.readInt16LE(11),-8);
    const raw=Buffer.alloc(4776);raw[8+29*68+16]=255;
    assert.equal(parseProgrammingProfile(raw).keys[29].modify.wheel,-1);
    for(const wheel of [-129,128,255,1.5,NaN])assert.throws(()=>encodeModify(key,0,0,{...mouse,wheel}),/wheel/);
  });
test('encodes layer assignment payload',()=>{const b=require('./key-programming').encodeLayer({row:2,col:1,locked:1},0,23,1);assert.deepEqual([...b.subarray(8,12)],[19,1,0,0]);});
test('validates and encodes M6UP MT10 fields',()=>{const b=require('./key-programming').encodeMt10({row:2,col:1},0,{shortRow:2,shortCol:1,longRow:3,longCol:4,shortDelay:120,longDelay:300});assert.equal(b[2],13);assert.deepEqual([...b.subarray(9,13)],[2,1,3,4]);assert.equal(b.readUInt16LE(13),120);assert.equal(b.readUInt16LE(15),300);});
test('keeps confirmed M6UP command numbers centralized',()=>{const {PROG_CMD}=require('./m6up-commands');assert.equal(PROG_CMD.MT10_SET_ON,13);assert.equal(PROG_CMD.APPLY_TO_ALL,7);assert.equal(PROG_CMD.SNAP_TAP_SET_ON,11);});
test('encodes confirmed single programming reset command',()=>{const b=require('./key-programming').encodeProgrammingReset({row:2,col:1,locked:0},1,12);assert.equal(b[2],2);assert.deepEqual([...b.subarray(3,8)],[1,12,0,2,1]);});
test('standard mouse restoration retains movement, wheel, mode and interval',()=>{
  const record=Buffer.alloc(68);Buffer.from('010000027856341203045634','hex').copy(record,8);
  const cmd=encodeModRestore({row:2,col:1,locked:0,mode:0,record},0,0);
  assert.equal(cmd.subarray(9).toString('hex'),'0102785634120304563400');
});

test('individual DKS never sets the apply-all flag',()=>{
  const {encodeDks}=require('./key-programming');
  const record=Buffer.alloc(12);record[1]=3;record[2]=3;record.writeUInt16LE(20,10);
  const cmd=encodeDks({row:2,col:1,locked:0},1,0,record);
  assert.equal(cmd.toString('hex'),'0803010100000201040003030000000000140000');
});

test('DKS mouse directions use signed vendor values and preserve inactive keys',()=>{
  const {buildDksRecord,parseDks,encodeDks}=require('./key-programming');
  const original=Buffer.alloc(12);original[1]=3;original[2]=1;
  const record=buildDksRecord(original,'left',10),parsed=parseDks(record);
  assert.equal(parsed.x,-8);assert.equal(parsed.mouseAction,'left');assert.equal(parsed.row,3);
  const command=encodeDks({row:2,col:1,locked:0},0,0,record);
  assert.equal(command.readUInt16LE(11),65528);assert.equal(command[19],0);
  assert.equal(parseDks(buildDksRecord(original,'wheel-down',100)).wheel,-1);
  for(const interval of [0,9,101,20.5])assert.throws(()=>buildDksRecord(original,'up',interval),/10 to 100/);
});
