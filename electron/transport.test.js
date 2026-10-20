'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { M6UPTransport } = require('./transport');

test('Hall Effect writes are committed to device memory after readback', async () => {
  const calls = [];
  const transport = new M6UPTransport({
    writeSelectedKey: async request => { calls.push(['write', request]); return { verified: true, key: request }; },
    saveToDeviceMemory: async () => { calls.push(['save']); return { acknowledged: true, command: 'SAVE_END' }; },
  });

  const request = { id: '2:1', layer: 0, rtOn: true, trigger: 0.2, release: 0.2 };
  const result = await transport.saveSelectedKey(request);
  assert.deepEqual(calls, [['write', request], ['save']]);
  assert.equal(result.verified, true);
  assert.equal(result.persistence.command, 'SAVE_END');
});

test('failed memory commit reports that the HE change was not persisted', async () => {
  const transport = new M6UPTransport({
    writeSelectedKey: async () => ({ verified: true }),
    saveToDeviceMemory: async () => { throw new Error('keyboard disconnected'); },
  });

  await assert.rejects(transport.saveSelectedKey({}), /not saved to device memory: keyboard disconnected/);
});
