'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { createRequire } = require('node:module');

test('Cfx wiring boots and exposes private status operations', () => {
  const resourceRoot = path.resolve(__dirname, '..');
  const mainPath = path.join(resourceRoot, 'server', 'main.js');
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'Fluxcore-status-main-'));
  const eventHandlers = new Map();
  const netHandlers = new Map();
  const registeredExports = new Map();
  const emitted = [];
  const intervals = new Set();
  const player = {
    source: 7,
    characterId: 'vrd_0123456789abcdef',
  };

  function registerExport(name, handler) {
    registeredExports.set(name, handler);
  }
  registerExport.fluxcore_core = {
    GetPlayerData(identifier) {
      return Number(identifier) === 7 || identifier === player.characterId
        ? player
        : null;
    },
    GetPlayers() {
      return [player];
    },
    GetPlayerSource(characterId) {
      return characterId === player.characterId ? 7 : 0;
    },
  };
  const usableItems = new Map();
  registerExport.fluxcore_inventory = {
    RegisterUsableItem(itemName, handler) {
      usableItems.set(itemName, handler);
      return { ok: true, data: true };
    },
  };

  const context = {
    require: createRequire(mainPath),
    Buffer,
    console,
    Date,
    GetCurrentResourceName() {
      return 'fluxcore_status';
    },
    GetResourcePath() {
      return temporaryRoot;
    },
    GetResourceState(resourceName) {
      return resourceName === 'fluxcore_inventory' ? 'started' : 'missing';
    },
    LoadResourceFile(_resource, relativePath) {
      return fs.readFileSync(path.join(resourceRoot, relativePath), 'utf8');
    },
    emitNet(eventName, source, ...args) {
      emitted.push({ eventName, source, args });
    },
    on(eventName, handler) {
      eventHandlers.set(eventName, handler);
    },
    onNet(eventName, handler) {
      netHandlers.set(eventName, handler);
    },
    exports: registerExport,
    setInterval(handler) {
      intervals.add(handler);
      return handler;
    },
    clearInterval(handler) {
      intervals.delete(handler);
    },
    setTimeout(handler) {
      handler();
    },
  };
  context.global = context;
  vm.createContext(context);

  try {
    vm.runInContext(fs.readFileSync(mainPath, 'utf8'), context, {
      filename: mainPath,
    });
    assert.equal(netHandlers.has('fluxcore_status:server:request'), true);
    assert.equal(registeredExports.has('GetStatus'), true);
    assert.equal(registeredExports.has('RemoveStatus'), true);
    assert.equal(intervals.size, 1);
    assert.equal(registeredExports.get('GetStatus')(7).hunger, 100);
    assert.deepEqual(
      [...usableItems.keys()].sort(),
      ['bandage', 'sandwich', 'water'],
    );

    const response = registeredExports.get('RemoveStatus')(7, 'hunger', 10);
    assert.equal(response.ok, true);
    assert.equal(response.data.hunger, 90);
    assert.equal(
      emitted.some(
        (event) => event.eventName === 'fluxcore_status:client:update',
      ),
      true,
    );
    const sandwich = usableItems.get('sandwich')(7);
    assert.equal(sandwich.consume, 1);
    sandwich.afterUse();
    assert.equal(registeredExports.get('GetStatus')(7).hunger, 100);
    assert.equal(usableItems.get('water')(7), false);
    const bandage = usableItems.get('bandage')(7);
    assert.equal(bandage.consume, 1);
    bandage.afterUse();
    assert.equal(
      emitted.some(
        (event) => event.eventName === 'fluxcore_status:client:heal'
          && event.source === 7
          && event.args[0] === 25,
      ),
      true,
    );

    eventHandlers.get('onResourceStop')('fluxcore_status');
    assert.equal(intervals.size, 0);
  } finally {
    fs.rmSync(temporaryRoot, {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 50,
    });
  }
});
