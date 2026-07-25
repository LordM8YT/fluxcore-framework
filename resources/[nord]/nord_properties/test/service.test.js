'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { validateConfig } = require('../server/config');
const { PropertiesDatabase } = require('../server/database');
const { PropertiesService } = require('../server/service');

function fixture(
  removeMoney = { ok: true, data: {} },
  emitClientFailure = false,
) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'varde-properties-'));
  const players = [
    {
      source: 7,
      characterId: 'vrd_1111111111111111',
      profile: {},
    },
    {
      source: 8,
      characterId: 'vrd_2222222222222222',
      profile: {},
    },
  ];
  const config = validateConfig(
    {
      databaseFile: 'properties.sqlite',
      properties: {
        test_home: {
          label: 'Test Home',
          type: 'house',
          price: 100,
          entry: { x: 1, y: 2, z: 3 },
          stash: { slots: 10, maxWeight: 1000 },
        },
      },
    },
    directory,
  );
  const database = new PropertiesDatabase(config.databaseFile);
  const emitted = [];
  const refunds = [];
  const service = new PropertiesService(
    database,
    config,
    {
      core: {
        getPlayerData(identifier) {
          return players.find(
            (player) =>
              player.source === Number(identifier) ||
              player.characterId === identifier,
          );
        },
        getPlayerSource(characterId) {
          return players.find((player) => player.characterId === characterId)
            ?.source;
        },
        getCharacterData(characterId) {
          return players.some((player) => player.characterId === characterId)
            ? { ok: true, data: { characterId } }
            : { ok: false, error: { code: 'CHARACTER_NOT_FOUND' } };
        },
        removeMoney() {
          return removeMoney;
        },
        addMoney(_source, _currency, amount) {
          refunds.push(amount);
          return { ok: true, data: {} };
        },
      },
      inventory: {
        registerStash() {
          return { ok: true, data: {} };
        },
        openInventory() {
          return { ok: true, data: { container: 'property:test_home' } };
        },
      },
    },
    {
      emitClient(...args) {
        if (emitClientFailure) throw new Error('client sync failed');
        emitted.push(args);
      },
      log() {},
    },
  );
  return { database, emitted, refunds, service };
}

test('buyer purchases a nearby property and can manage access', () => {
  const { database, service } = fixture();
  const position = { x: 1, y: 2, z: 3 };
  assert.equal(service.purchase(7, 'test_home', position).isOwner, true);
  assert.equal(
    service.giveKey(
      7,
      'test_home',
      'vrd_2222222222222222',
      position,
    ).keys.length,
    1,
  );
  assert.equal(service.hasAccess(8, 'test_home'), true);
  assert.equal(
    service.openStorage(8, 'test_home', position).container,
    'property:test_home',
  );
  database.close();
});

test('failed payment releases the purchase reservation', () => {
  const { database, service } = fixture({
    ok: false,
    error: { code: 'INSUFFICIENT_FUNDS', message: 'not enough money' },
  });
  assert.throws(
    () => service.purchase(7, 'test_home', { x: 1, y: 2, z: 3 }),
    /not enough money/u,
  );
  assert.equal(database.reserve('test_home', 'next'), true);
  database.close();
});

test('completed ownership is not refunded when client sync fails', () => {
  const { database, refunds, service } = fixture(
    { ok: true, data: {} },
    true,
  );
  const property = service.purchase(7, 'test_home', { x: 1, y: 2, z: 3 });
  assert.equal(property.isOwner, true);
  assert.deepEqual(refunds, []);
  assert.equal(database.get('test_home').ownerCharacterId, 'vrd_1111111111111111');
  database.close();
});
