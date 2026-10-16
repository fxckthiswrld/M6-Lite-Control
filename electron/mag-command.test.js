const { test } = require('node:test');
const assert = require('node:assert/strict');
const { encodeMagCommandRaw } = require('./mag-command');
const config = {command:1,layer:2,row:3,col:4,rtOn:1,head:0x1234,trigger:0x5678,release:0x9abc,fixedDown:0xdef0,fixedUp:0x1357,bottom:0x2468};
test('internal magnetic command fields and little-endian words', () => {
  assert.equal(encodeMagCommandRaw(config).toString('hex'), '0831010203040134127856bc9af0de57136824');
});
test('reject invalid raw values instead of silently truncating or wrapping', () => {
  for (const value of [-1,65536,NaN,Infinity,0.2,undefined])
    assert.throws(() => encodeMagCommandRaw({...config,head:value}), RangeError);
  assert.throws(() => encodeMagCommandRaw({...config,row:256}), RangeError);
});
