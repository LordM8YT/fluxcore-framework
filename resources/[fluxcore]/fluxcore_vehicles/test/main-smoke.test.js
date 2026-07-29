'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');

test('Cfx wiring boots and registers vehicle and trunk APIs', () => {
  const resourceRoot = path.resolve(__dirname, '..');
  const mainPath = path.join(resourceRoot, 'server', 'main.js');
  const temporaryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'Fluxcore-vehicles-main-'),
  );
  const eventHandlers = new Map();
  const netHandlers = new Map();
  const commands = new Map();
  const registeredExports = new Map();
  const emitted = [];
  const entityState = [];
  const player = { characterId: 'vrd_0123456789abcdef' };

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
      return [];
    },
    GetPlayerSource(characterId) {
      return characterId === player.characterId ? 7 : 0;
    },
  };
  registerExport.fluxcore_inventory = {
    RegisterContainer() {
      return { ok: true, data: true };
    },
    OpenInventory() {
      return { ok: true, data: true };
    },
    DeleteContainer() {
      return { ok: true, data: true };
    },
  };

  const context = {
    require: createRequire(mainPath),
    console,
    GetCurrentResourceName() {
      return 'fluxcore_vehicles';
    },
    GetResourcePath() {
      return temporaryRoot;
    },
    LoadResourceFile(_resource, relativePath) {
      return fs.readFileSync(path.join(resourceRoot, relativePath), 'utf8');
    },
    GetInvokingResource() {
      return 'smoke_test';
    },
    GetHashKey() {
      return 123;
    },
    GetPlayerPed() {
      return 70;
    },
    GetEntityCoords() {
      return { x: 275.58, y: -344.74, z: 45.17 };
    },
    GetPedInVehicleSeat() {
      return 70;
    },
    GetAllVehicles() {
      return [];
    },
    CreateVehicleServerSetter() {
      return 100;
    },
    DoesEntityExist(entity) {
      return Number(entity) === 100;
    },
    SetEntityOrphanMode() {},
    SetVehicleNumberPlateText() {},
    SetVehicleDoorsLocked() {},
    Entity() {
      return {
        state: {
          set(key, value, replicated) {
            entityState.push({ key, value, replicated });
          },
        },
      };
    },
    NetworkGetNetworkIdFromEntity() {
      return 55;
    },
    NetworkGetEntityFromNetworkId(networkId) {
      return Number(networkId) === 55 ? 100 : 0;
    },
    DeleteEntity() {},
    emitNet(eventName, source, ...args) {
      emitted.push({ eventName, source, args });
    },
    on(eventName, handler) {
      eventHandlers.set(eventName, handler);
    },
    onNet(eventName, handler) {
      netHandlers.set(eventName, handler);
    },
    RegisterCommand(name, handler) {
      commands.set(name, handler);
    },
    exports: registerExport,
    setTimeout(handler) {
      handler();
      return 1;
    },
  };
  context.global = context;
  vm.createContext(context);

  try {
    vm.runInContext(fs.readFileSync(mainPath, 'utf8'), context, {
      filename: mainPath,
    });
    assert.equal(netHandlers.has('fluxcore_vehicles:server:spawn'), true);
    assert.equal(netHandlers.has('fluxcore_vehicles:server:trunk'), true);
    assert.equal(netHandlers.has('fluxcore_vehicles:server:toggleEngine'), true);
    assert.equal(commands.has('givevehicle'), true);
    assert.equal(registeredExports.has('RegisterOwnedVehicle'), true);

    const created = registeredExports.get('RegisterOwnedVehicle')(7, {
      model: 'sultan',
      vehicleType: 'automobile',
      garageId: 'motelgarage',
    });
    assert.equal(created.ok, true);
    assert.equal(registeredExports.get('GetVehicles')(7).length, 1);
    const spawned = registeredExports.get('SpawnVehicle')(
      7,
      created.data.id,
      'motelgarage',
    );
    assert.equal(spawned.ok, true);
    assert.equal(spawned.data.networkId, 55);
    assert.equal(entityState[0].key, 'Fluxcore:initVehicle');
    assert.equal(
      entityState.some(
        (entry) => entry.key === 'Fluxcore:engineOn'
          && entry.value === false
          && entry.replicated === true,
      ),
      true,
    );
    context.source = 7;
    netHandlers.get('fluxcore_vehicles:server:toggleEngine')(55, true);
    assert.equal(
      entityState.some(
        (entry) => entry.key === 'Fluxcore:engineOn'
          && entry.value === true,
      ),
      true,
    );
    assert.equal(
      emitted.some(
        (entry) => entry.eventName === 'fluxcore_vehicles:client:engineChanged'
          && entry.source === -1
          && entry.args[0] === 55
          && entry.args[1] === true,
      ),
      true,
    );

    eventHandlers.get('Fluxcore:server:playerLoaded')(7, player);
    assert.equal(
      emitted.some(
        (entry) => entry.eventName === 'fluxcore_vehicles:client:update',
      ),
      true,
    );
    eventHandlers.get('onResourceStart')('fluxcore_inventory');
    eventHandlers.get('onResourceStop')('fluxcore_vehicles');
  } finally {
    fs.rmSync(temporaryRoot, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 20,
    });
  }
});
