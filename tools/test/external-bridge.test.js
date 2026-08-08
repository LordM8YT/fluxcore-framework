'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { installBridge } = require('../create-bridge');

const root = path.resolve(__dirname, '..', '..');

test('resource bridge v1 and templates expose the same stable methods', () => {
  const contract = JSON.parse(fs.readFileSync(
    path.join(root, 'contracts', 'resource-bridge', 'v1.json'),
    'utf8',
  ));
  const server = fs.readFileSync(
    path.join(root, 'templates', 'multiframework_bridge', 'fluxcore', 'server.lua'),
    'utf8',
  );
  const client = fs.readFileSync(
    path.join(root, 'templates', 'multiframework_bridge', 'fluxcore', 'client.lua'),
    'utf8',
  );
  assert.equal(contract.contract, 'fluxcore.resource-bridge.v1');
  assert.equal(contract.status, 'stable');
  for (const method of contract.server) {
    assert.match(server, new RegExp(`function Bridge\\.${method}\\(`, 'u'));
  }
  for (const method of contract.client) {
    assert.match(client, new RegExp(`function Bridge\\.${method}\\(`, 'u'));
  }
});

test('bridge installer copies adapter without overwriting external code', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'fluxcore-bridge-'));
  try {
    const installed = installBridge(temporary);
    assert.equal(installed, path.join(temporary, 'fluxcore'));
    assert.ok(fs.existsSync(path.join(installed, 'client.lua')));
    assert.ok(fs.existsSync(path.join(installed, 'server.lua')));
    assert.throws(() => installBridge(temporary), /already exists/u);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test('runtime bridge exposes portable domains without owning their data', () => {
  const server = fs.readFileSync(
    path.join(root, 'resources', '[fluxcore]', 'fluxcore_bridge', 'server.lua'),
    'utf8',
  );
  const client = fs.readFileSync(
    path.join(root, 'resources', '[fluxcore]', 'fluxcore_bridge', 'client.lua'),
    'utf8',
  );
  assert.match(server, /exports\('RegisterOwnedVehicle'/u);
  assert.match(server, /exports\('CreditBusiness'/u);
  assert.match(server, /fluxcore_bridge:client:notify/u);
  assert.match(client, /exports\('GetPlayerData'/u);
  assert.match(client, /RegisterNetEvent\('fluxcore_bridge:client:notify'/u);
  assert.doesNotMatch(server, /RegisterNetEvent/u);
});
