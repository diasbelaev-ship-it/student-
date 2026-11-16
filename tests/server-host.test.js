const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveBindAddress } = require('../server/runtime-host');

test('keeps the local server loopback-only by default', () => {
  assert.equal(resolveBindAddress({}), '127.0.0.1');
});

test('binds to all interfaces in GitHub Codespaces', () => {
  assert.equal(resolveBindAddress({ CODESPACES: 'true' }), '0.0.0.0');
});

test('uses an explicit host override', () => {
  assert.equal(resolveBindAddress({ CODESPACES: 'true', HOST: '10.0.0.8' }), '10.0.0.8');
});
