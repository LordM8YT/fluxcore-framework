'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..', '..', 'resources', '[fluxcore]');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('generic bridge exposes v1 capabilities and restart-safe adapter ownership', () => {
  const source = read('fluxcore_bridge', 'server.lua');
  assert.match(source, /api = 'fluxcore\.bridge\.v1'/u);
  assert.match(source, /GetInvokingResource\(\)/u);
  assert.match(source, /validExportName[\s\S]*A-Z/u);
  assert.match(source, /onResourceStop[\s\S]*adapters\[name\] = nil/u);
  assert.match(source, /exports\('CallAdapter'/u);
});

test('QBCore bridge is isolated, explicit and limited', () => {
  const manifest = read('fluxcore_qb_bridge', 'fxmanifest.lua');
  const source = read('fluxcore_qb_bridge', 'server.lua');
  assert.match(manifest, /provide 'qb-core'/u);
  assert.match(manifest, /dependencies[\s\S]*'fluxcore_bridge'/u);
  assert.match(source, /exports\('GetCoreObject'/u);
  assert.match(source, /QBCore\.Functions\.GetPlayer/u);
  assert.match(source, /startedResource == 'fluxcore_bridge'/u);
  assert.match(source, /pcall[\s\S]*RegisterAdapter/u);
  assert.doesNotMatch(source, /RegisterNetEvent\([^)]*AddMoney/u);
});

test('Qbox bridge exposes only the documented server-side porting surface', () => {
  const manifest = read('fluxcore_qbx_bridge', 'fxmanifest.lua');
  const source = read('fluxcore_qbx_bridge', 'server.lua');
  assert.match(manifest, /provide 'qbx_core'/u);
  assert.match(source, /exports\('GetPlayer'/u);
  assert.match(source, /exports\('GetPlayersData'/u);
  assert.match(source, /exports\('AddMoney'/u);
  assert.match(source, /exports\('SetJobDuty'/u);
  assert.match(source, /RegisterAdapter\('qbox'/u);
  assert.doesNotMatch(source, /RegisterNetEvent/u);
});

test('ESX bridge exposes a bounded shared object for server-side porting', () => {
  const manifest = read('fluxcore_esx_bridge', 'fxmanifest.lua');
  const source = read('fluxcore_esx_bridge', 'server.lua');
  assert.match(manifest, /provide 'es_extended'/u);
  assert.match(source, /exports\('getSharedObject'/u);
  assert.match(source, /ESX\.GetPlayerFromId/u);
  assert.match(source, /xPlayer\.addAccountMoney/u);
  assert.match(source, /xPlayer\.addInventoryItem/u);
  assert.match(source, /RegisterAdapter\('esx'/u);
  assert.doesNotMatch(source, /RegisterNetEvent/u);
});
