'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('Cfx wiring boots and registers banking APIs', (t) => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'Nord-bank-main-'));
  const resourceRoot = path.resolve(__dirname, '..');
  fs.cpSync(path.join(resourceRoot, 'config'), path.join(temporaryRoot, 'config'), {
    recursive: true,
  });
  const handlers = new Map();
  const netHandlers = new Map();
  const registeredExports = new Map();
  const players = new Map([
    [
      7,
      {
        characterId: 'vrd_0123456789abcdef',
        money: { cash: 500, bank: 5000 },
      },
    ],
  ]);
  const coreExports = {
    GetPlayerData(identifier) {
      return players.get(Number(identifier)) || null;
    },
    GetPlayerSource() {
      return 7;
    },
    GetMoney(identifier, currency) {
      return { ok: true, data: players.get(Number(identifier)).money[currency] };
    },
    GetMoneyLedger() {
      return { ok: true, data: [] };
    },
    MoveMoney() {
      return { ok: true, data: true };
    },
    TransferMoney() {
      return { ok: true, data: true };
    },
  };

  Object.assign(global, {
    GetCurrentResourceName() {
      return 'nord_banking';
    },
    GetResourcePath() {
      return temporaryRoot;
    },
    LoadResourceFile(_resource, relativePath) {
      return fs.readFileSync(path.join(resourceRoot, relativePath), 'utf8');
    },
    GetPlayerPed() {
      return 1;
    },
    GetEntityCoords() {
      return [149.14, -1040.54, 29.37];
    },
    Player() {
      return { state: { set() {} } };
    },
    emitNet() {},
    on(name, handler) {
      handlers.set(name, handler);
    },
    onNet(name, handler) {
      netHandlers.set(name, handler);
    },
  });
  globalThis.exports = function register(name, handler) {
    registeredExports.set(name, handler);
  };
  Object.assign(globalThis.exports, { nord_core: coreExports });

  const mainPath = require.resolve('../server/main');
  delete require.cache[mainPath];
  require(mainPath);

  t.after(() => {
    handlers.get('onResourceStop')?.('nord_banking');
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
    for (const key of [
      'GetCurrentResourceName',
      'GetResourcePath',
      'LoadResourceFile',
      'GetPlayerPed',
      'GetEntityCoords',
      'Player',
      'emitNet',
      'on',
      'onNet',
      'exports',
    ]) {
      delete global[key];
    }
  });

  assert.equal(netHandlers.has('nord_banking:server:request'), true);
  assert.equal(handlers.has('Nord:server:playerLoaded'), true);
  assert.equal(registeredExports.has('GetAccount'), true);
  assert.equal(registeredExports.has('Transfer'), true);
});
