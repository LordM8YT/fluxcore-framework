'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..', '..');
const core = path.join(root, 'resources', '[fluxcore]', 'fluxcore_core');

test('core client and server use the same case-sensitive RPC event', () => {
  const client = fs.readFileSync(
    path.join(core, 'client', 'main.lua'),
    'utf8',
  );
  const server = fs.readFileSync(path.join(core, 'server', 'main.js'), 'utf8');

  assert.match(
    client,
    /TriggerServerEvent\('Fluxcore:server:rpc'/u,
  );
  assert.match(
    server,
    /onNet\('Fluxcore:server:rpc'/u,
  );
  assert.doesNotMatch(client, /TriggerServerEvent\('fluxcore:server:rpc'/u);
});
