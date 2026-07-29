'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const contractRoot = path.resolve(
  __dirname,
  '..',
  '..',
  'contracts',
  'ui',
  'v1',
);

function fixture(name) {
  return JSON.parse(fs.readFileSync(path.join(contractRoot, name), 'utf8'));
}

test('UI v1 mock payloads are parseable and versioned', () => {
  const mocks = fs
    .readdirSync(contractRoot)
    .filter((name) => name.endsWith('.bootstrap.json'))
    .map(fixture);

  for (const mock of mocks) {
    assert.match(mock.contract, /^fluxcore\.[a-z]+\.bootstrap\.v1$/u);
  }
  assert.ok(mocks.length >= 10);
});

test('inventory mock uses opaque sides instead of trusted container input', () => {
  const mock = fixture('inventory.bootstrap.json');
  assert.equal(mock.player.type, 'player');
  assert.equal(mock.secondary, null);
  assert.ok(Array.isArray(mock.hotbar));
  assert.equal(mock.capabilities.transfer, false);
});

test('HUD and phone mocks contain only owner-facing public shapes', () => {
  const hud = fixture('hud.bootstrap.json');
  const phone = fixture('phone.bootstrap.json');

  assert.equal(typeof hud.status.hunger, 'number');
  assert.equal(typeof hud.player.money.bank, 'number');
  assert.match(phone.account.phoneNumber, /^\d+$/u);
  assert.equal(phone.conversations[0].lastMessage.readAt, null);
});

test('status resource renders HUD v1 and restores the vanilla radar on stop', () => {
  const statusRoot = path.resolve(
    __dirname,
    '..',
    '..',
    'resources',
    '[fluxcore]',
    'fluxcore_status',
  );
  const manifest = fs.readFileSync(
    path.join(statusRoot, 'fxmanifest.lua'),
    'utf8',
  );
  const client = fs.readFileSync(
    path.join(statusRoot, 'client', 'main.lua'),
    'utf8',
  );
  const frontend = fs.readFileSync(
    path.join(statusRoot, 'web', 'app.js'),
    'utf8',
  );

  assert.match(manifest, /ui_page 'web\/index\.html'/u);
  assert.match(client, /action = 'fluxcore:hud:bootstrap'/u);
  assert.match(client, /HideHudComponentThisFrame/u);
  assert.match(client, /onClientResourceStop[\s\S]*DisplayRadar\(true\)/u);
  assert.match(frontend, /fluxcore:hud:bootstrap/u);
});
