'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..', '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('admin actions are retry-safe and the player list refreshes while open', () => {
  const client = read('resources', '[fluxcore]', 'fluxcore_admin', 'web', 'app.js');
  const server = read('resources', '[fluxcore]', 'fluxcore_admin', 'server', 'main.js');

  assert.match(client, /operationId:\s*operationId\(method\)/u);
  assert.match(client, /setInterval\([\s\S]*refreshPlayers/u);
  assert.match(client, /AbortController/u);
  assert.match(server, /const completedOperations = new Map\(\)/u);
  assert.match(server, /MUTATING_METHODS/u);
  assert.match(server, /rememberOperation\(key, result\)/u);
});

test('voice disconnect and restart paths clean up and recover auxiliary channels', () => {
  const voice = read('resources', '[fluxcore]', 'fluxcore_voice', 'server.lua');
  const phone = read('resources', '[fluxcore]', 'fluxcore_phone', 'server', 'main.js');

  assert.match(voice, /removePlayerFromAuxiliaryChannels\(source\)/u);
  assert.match(voice, /removePlayerFromAuxiliaryChannels\(playerSource\)/u);
  assert.match(phone, /function recoverVoiceChannels\(\)/u);
  assert.match(phone, /startedResource === 'fluxcore_voice'/u);
  assert.match(phone, /stoppedResource === 'fluxcore_voice'/u);
  assert.match(phone, /DeleteManagedVoiceChannel/u);
});

test('inventory always releases its pending state after an NUI operation', () => {
  const inventory = read('resources', '[fluxcore]', 'fluxcore_inventory', 'web', 'app.js');

  assert.match(inventory, /async function perform[\s\S]*finally\s*\{[\s\S]*busy = false/u);
  assert.match(inventory, /clearDragState\(\);[\s\S]*Working…/u);
});

test('core exposes an ACE-protected health command and snapshot', () => {
  const core = read('resources', '[fluxcore]', 'fluxcore_core', 'server', 'main.js');

  assert.match(core, /globalThis\.exports\('GetHealth', healthSnapshot\)/u);
  assert.match(core, /RegisterCommand\('fluxhealth'/u);
  assert.match(core, /fluxcore\.health/u);
});
