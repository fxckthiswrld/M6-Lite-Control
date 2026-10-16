'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { encodeOutputReport } = require('./hid-frame');

test('matches original MMPanel output buffer independently read from runtime', () => {
  // m6-live-state4.txt: sendBuf.data[1] and UsbDevice.Uqc82XPVxA.
  const payload = Buffer.from('0200000000000000000000000000000000000000', 'hex');
  const snapshot = Buffer.from('048c96ce6af272994858612758e89a7f0195eeed2f', 'hex');
  assert.deepEqual(encodeOutputReport(payload), snapshot);
  assert.equal(payload[0], 2);
});

test('rejects incomplete commands rather than guessing trailing queue bytes', () => {
  for (const value of [null, [], Buffer.alloc(19), Buffer.alloc(21)])
    assert.throws(() => encodeOutputReport(value), TypeError);
});
