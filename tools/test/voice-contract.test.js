'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..', '..');
const resource = path.join(root, 'resources', '[fluxcore]', 'fluxcore_voice');
const read = (...parts) => fs.readFileSync(path.join(resource, ...parts), 'utf8');

test('voice resource uses the guarded Enhanced internal voice API', () => {
  const manifest = read('fxmanifest.lua');
  const server = read('server.lua');

  assert.match(manifest, /dependency 'fluxcore_core'/u);
  assert.match(manifest, /client_script 'client\/main\.lua'/u);
  assert.match(manifest, /server_script 'server\.lua'/u);
  assert.match(server, /type\(CreateVoiceChannel\) == 'function'/u);
  assert.match(server, /pcall\(\s*CreateVoiceChannel/u);
  assert.match(server, /pcall\(AddPlayerToVoiceChannel,\s*channel,\s*id\)/u);
  assert.match(server, /SetPlayerMutedInVoiceChannel/u);
  assert.match(server, /pcall\(RemovePlayerFromVoiceChannel,\s*channel,\s*id\)/u);
  assert.match(server, /pcall\(DeleteVoiceChannel,\s*channel\)/u);
  assert.match(server, /fluxcore_voice:server:cycleProximity/u);
  assert.match(server, /now - \(lastCycleAt\[playerSource\] or 0\) < 500/u);
  assert.doesNotMatch(server, /AddEventHandler\('playerJoining'/u);
  assert.match(server, /AddEventHandler\('playerDropped'/u);
  assert.match(server, /AddEventHandler\('Fluxcore:server:playerLoaded'/u);
  assert.match(server, /AddEventHandler\('Fluxcore:server:playerLoggedOut'/u);
  assert.match(server, /GetPlayerData\(tonumber\(playerSource\)\)/u);
  assert.doesNotMatch(server, /mumble/iu);
});

test('voice client exports bounded, Enhanced-compatible talking state', () => {
  const client = read('client', 'main.lua');
  const config = JSON.parse(read('config', 'voice.json'));

  assert.deepEqual(config.proximityDistances, [3, 8, 15]);
  assert.equal(config.defaultProximityIndex, 2);
  assert.ok(config.talkingPollMs >= 50 && config.talkingPollMs <= 1000);
  assert.match(client, /NetworkIsPlayerTalking\(PlayerId\(\)\)/u);
  assert.match(client, /ready[\s\S]*talkingValue == true or talkingValue == 1/u);
  assert.match(client, /exports\('GetVoiceState'/u);
  assert.match(client, /fluxcore_voice:client:stateChanged/u);
  assert.match(client, /snapshot and snapshot\.ready ~= false/u);
  assert.match(client, /RegisterKeyMapping\([\s\S]*'\+fluxcore_voice_distance'[\s\S]*'GRAVE'/u);
  assert.match(client, /fluxcore_voice:server:cycleProximity/u);
});
