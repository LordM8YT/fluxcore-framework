'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { FuelService } = require('../server/service');
const { validateConfig } = require('../server/config');

function harness() {
  const payments = [];
  const items = [];
  const config = validateConfig({
    currency: 'cash',
    pricePerLiter: 3,
    minimumLiters: 1,
    maximumLiters: 100,
    consumptionMultiplier: 1,
    requestWindowMs: 10000,
    requestLimit: 8,
    stations: {
      test: {
        label: 'Test Station',
        x: 10,
        y: 20,
        z: 30,
        radius: 10,
      },
    },
  });
  const core = {
    getPlayerData(source) {
      return Number(source) === 7
        ? { characterId: 'vrd_0123456789abcdef' }
        : null;
    },
    removeMoney(source, currency, amount, reason, reference) {
      payments.push({ source, currency, amount, reason, reference });
      return { ok: true, data: 500 - amount };
    },
    addMoney(source, currency, amount, reason, reference) {
      payments.push({ source, currency, amount, reason, reference });
      return { ok: true, data: 500 + amount };
    },
  };
  const runtime = {
    playerPed() {
      return 70;
    },
    vehicleFromNetwork() {
      return 80;
    },
    entityType() {
      return 2;
    },
    entityCoordinates() {
      return [10, 20, 30];
    },
    canCarryItem() {
      return true;
    },
    addItem(source, itemName, amount, metadata) {
      items.push({ action: 'add', source, itemName, amount, metadata });
      return { ok: true, data: true };
    },
    removeItem(source, itemName, amount) {
      items.push({ action: 'remove', source, itemName, amount });
      return { ok: true, data: true };
    },
  };
  return {
    service: new FuelService(config, core, runtime),
    payments,
    items,
    runtime,
  };
}

test('fuel purchase validates vehicle access and charges exact liters', () => {
  const { service, payments } = harness();
  const purchase = service.purchase(7, 12, 'test', 12.4);

  assert.equal(purchase.liters, 12.4);
  assert.equal(purchase.cost, 38);
  assert.equal(purchase.networkId, 12);
  assert.equal(payments[0].currency, 'cash');
  assert.equal(payments[0].reason, 'fuel_purchase');
  assert.match(payments[0].reference, /^fuel:/u);
});

test('fuel purchase rejects remote stations and remote players', () => {
  const remote = harness();
  remote.runtime.entityCoordinates = () => [100, 100, 30];
  assert.throws(() => remote.service.purchase(7, 12, 'test', 10), {
    code: 'STATION_REQUIRED',
  });

  const distantPlayer = harness();
  distantPlayer.runtime.entityCoordinates = (entity) =>
    entity === 70 ? [100, 100, 30] : [10, 20, 30];
  assert.throws(() => distantPlayer.service.purchase(7, 12, 'test', 10), {
    code: 'VEHICLE_DISTANCE',
  });
});

test('fuel cans are purchased into inventory and consumed at the vehicle', () => {
  const { service, payments, items } = harness();
  const purchase = service.buyCan(7, 'test');
  assert.equal(purchase.liters, 20);
  assert.equal(payments[0].reason, 'fuel_can_purchase');
  assert.equal(items[0].action, 'add');
  assert.equal(items[0].itemName, 'fuel_can');

  const used = service.useCan(7, 12);
  assert.equal(used.usedCan, true);
  assert.equal(used.liters, 20);
  assert.equal(items[1].action, 'remove');
});

test('fuel configuration and purchase amounts stay bounded', () => {
  const { service } = harness();
  assert.throws(() => service.purchase(7, 12, 'test', 0.1), {
    code: 'LITERS_INVALID',
  });
  assert.throws(() => service.purchase(7, 12, 'test', 101), {
    code: 'LITERS_INVALID',
  });
  assert.throws(
    () =>
      validateConfig({
        pricePerLiter: 0,
        stations: {
          test: { label: 'Test', x: 0, y: 0, z: 0, radius: 10 },
        },
      }),
    { code: 'CONFIG_INVALID' },
  );
});
