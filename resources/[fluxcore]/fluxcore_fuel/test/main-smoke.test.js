'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Cfx wiring boots and exposes the fuel purchase boundary', (t) => {
  const resourceRoot = path.resolve(__dirname, '..');
  const netHandlers = new Map();
  const handlers = new Map();
  const registeredExports = new Map();
  const emitted = [];
  let usableRegistrations = 0;

  Object.assign(global, {
    GetCurrentResourceName() {
      return 'fluxcore_fuel';
    },
    GetResourceState(resourceName) {
      return resourceName === 'fluxcore_inventory' ? 'started' : 'missing';
    },
    setTimeout(handler) {
      handler();
      return 1;
    },
    LoadResourceFile(_resource, relativePath) {
      return fs.readFileSync(path.join(resourceRoot, relativePath), 'utf8');
    },
    GetPlayerPed() {
      return 70;
    },
    NetworkGetEntityFromNetworkId() {
      return 80;
    },
    DoesEntityExist() {
      return true;
    },
    GetEntityType() {
      return 2;
    },
    GetPedInVehicleSeat() {
      return 70;
    },
    GetEntityCoords() {
      return [-70.21, -1761.79, 29.53];
    },
    emitNet(eventName, source, payload) {
      emitted.push({ eventName, source, payload });
    },
    onNet(name, handler) {
      netHandlers.set(name, handler);
    },
    on(name, handler) {
      handlers.set(name, handler);
    },
  });
  globalThis.exports = function register(name, handler) {
    registeredExports.set(name, handler);
  };
  Object.assign(globalThis.exports, {
    fluxcore_core: {
      GetPlayerData() {
        return { characterId: 'vrd_0123456789abcdef' };
      },
      RemoveMoney() {
        return { ok: true, data: 100 };
      },
      AddMoney() {
        return { ok: true, data: 100 };
      },
    },
    fluxcore_inventory: {
      RegisterUsableItem() {
        usableRegistrations += 1;
        return { ok: true, data: true };
      },
      CanCarryItem() {
        return true;
      },
      AddItem() {
        return { ok: true, data: true };
      },
      RemoveItem() {
        return { ok: true, data: true };
      },
    },
  });

  const mainPath = require.resolve('../server/main');
  delete require.cache[mainPath];
  require(mainPath);

  t.after(() => {
    delete require.cache[mainPath];
    for (const key of [
      'GetCurrentResourceName',
      'GetResourceState',
      'LoadResourceFile',
      'GetPlayerPed',
      'NetworkGetEntityFromNetworkId',
      'DoesEntityExist',
      'GetEntityType',
      'GetPedInVehicleSeat',
      'GetEntityCoords',
      'emitNet',
      'onNet',
      'on',
      'setTimeout',
      'exports',
      'source',
    ]) {
      delete global[key];
    }
  });

  assert.equal(netHandlers.has('fluxcore_fuel:server:purchase'), true);
  assert.equal(netHandlers.has('fluxcore_fuel:server:buyCan'), true);
  assert.equal(netHandlers.has('fluxcore_fuel:server:useCan'), true);
  assert.equal(registeredExports.has('PurchaseFuel'), true);
  assert.equal(usableRegistrations, 1);
  handlers.get('onResourceStart')('fluxcore_inventory');
  assert.equal(usableRegistrations, 2);

  global.source = 7;
  netHandlers.get('fluxcore_fuel:server:purchase')(12, 'davis', 10);
  assert.equal(emitted.at(-1).payload.ok, true);
  assert.equal(emitted.at(-1).payload.data.cost, 30);
});
