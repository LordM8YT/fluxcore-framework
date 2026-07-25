'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { validateConfig } = require('../server/config');
const { WorldDatabase } = require('../server/database');
const { WorldService } = require('../server/service');

function fixture(auditFailure = false) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'varde-world-'));
  const player = {
    source: 7,
    characterId: 'vrd_1111111111111111',
    job: { name: 'police', onDuty: true },
  };
  const config = validateConfig(
    {
      databaseFile: 'world.sqlite',
      shops: {
        shop: {
          label: 'Shop',
          position: { x: 1, y: 2, z: 3 },
          items: { water: 8 },
        },
      },
      dealerships: {
        dealer: {
          label: 'Dealer',
          position: { x: 1, y: 2, z: 3 },
          garageId: 'garage',
          vehicles: {
            blista: {
              label: 'Blista',
              price: 100,
              type: 'automobile',
            },
          },
        },
      },
      doors: {
        police_door: {
          label: 'Police Door',
          modelHash: 123,
          position: { x: 1, y: 2, z: 3 },
          defaultLocked: true,
          jobNames: ['police'],
          permission: 'police.duty',
        },
      },
    },
    directory,
  );
  const database = new WorldDatabase(config.databaseFile);
  if (auditFailure) {
    database.recordPurchase = () => {
      throw new Error('audit unavailable');
    };
  }
  const balances = { removed: 0, added: 0 };
  const service = new WorldService(
    database,
    config,
    {
      core: {
        getPlayerData() {
          return player;
        },
        getPlayerSource() {
          return 7;
        },
        getPlayers() {
          return [player];
        },
        removeMoney(_source, _currency, amount) {
          balances.removed += amount;
          return { ok: true, data: {} };
        },
        addMoney(_source, _currency, amount) {
          balances.added += amount;
          return { ok: true, data: {} };
        },
      },
      jobs: {
        hasPermission() {
          return true;
        },
      },
      inventory: {
        canCarryItem() {
          return true;
        },
        addItem() {
          return { ok: true, data: {} };
        },
      },
      vehicles: {
        registerOwnedVehicle() {
          return {
            ok: true,
            data: { id: 'veh_1111111111111111', plate: 'ABC123' },
          };
        },
      },
    },
    {
      emitClient() {},
      log() {},
    },
  );
  return { balances, database, service };
}

test('nearby player can buy items and vehicles', () => {
  const { balances, database, service } = fixture();
  const coordinates = { x: 1, y: 2, z: 3 };
  assert.equal(service.buyItem(7, 'shop', 'water', 2, coordinates).total, 16);
  assert.equal(
    service.buyVehicle(7, 'dealer', 'blista', coordinates).vehicle.plate,
    'ABC123',
  );
  assert.equal(balances.removed, 116);
  database.close();
});

test('authorized on-duty staff can update a nearby door', () => {
  const { database, service } = fixture();
  assert.equal(
    service.setDoorLocked(
      7,
      'police_door',
      false,
      { x: 1, y: 2, z: 3 },
    ).locked,
    false,
  );
  database.close();
});

test('successful delivery is not reported as failed when audit storage fails', () => {
  const { balances, database, service } = fixture(true);
  const purchase = service.buyItem(
    7,
    'shop',
    'water',
    2,
    { x: 1, y: 2, z: 3 },
  );
  assert.equal(purchase.total, 16);
  assert.equal(balances.removed, 16);
  assert.equal(balances.added, 0);
  database.close();
});
