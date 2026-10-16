'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {HeDevice}=require('./he-device');
for(const [kind,offset] of [['he',11],['programming',2]])test(`${kind}: restore active profile even when action fails`,()=>{
  const device=new HeDevice(null),original=Buffer.from([0,1,0,3,4,5,6,7,8,9,10,0,12,13]);
  let current=Buffer.from(original);const writes=[];
  device.readDeviceConfig=()=>Buffer.from(current);
  device.writeDeviceConfig=value=>{current=Buffer.from(value);writes.push(current);};
  assert.throws(()=>device.withLayer(kind,1,()=>{assert.equal(current[offset],1);throw new Error('Readback failed');}),/Readback failed/);
  assert.deepEqual(current,original);assert.equal(writes.length,2);
  const expected=Buffer.from(original);expected[offset]=1;assert.deepEqual(writes[0],expected);
});
test('already active profile avoids configuration writes',()=>{
  const device=new HeDevice(null);device.readDeviceConfig=()=>Buffer.alloc(14);
  device.writeDeviceConfig=()=>assert.fail('Unexpected write');
  assert.equal(device.withLayer('he',0,()=>42),42);
});
test('profile switch retries stale reads and timeouts without repeating the write',()=>{
  const device=new HeDevice(null),desired=Buffer.alloc(14,1);let writes=0,reads=0;
  device.send=()=>writes++;
  device.readDeviceConfig=()=>{if(++reads===1)return Buffer.alloc(14);if(reads===2)throw Error('Read timeout');return desired;};
  device.writeDeviceConfig(desired);assert.equal(writes,1);assert.equal(reads,3);
});
test('unverified profile selection never enters the action and restores original config',()=>{
  const device=new HeDevice(null);let actions=0,writes=0;
  device.readDeviceConfig=()=>Buffer.alloc(14);device.send=()=>writes++;
  assert.throws(()=>device.withLayer('programming',1,()=>actions++),/did not verify/);
  assert.equal(actions,0);assert.equal(writes,2);
});
