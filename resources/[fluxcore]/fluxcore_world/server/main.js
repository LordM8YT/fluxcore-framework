'use strict';

const { WorldDatabase } = require('./database');
const { WorldError, worldError } = require('./errors');
const { loadConfig } = require('./config');
const { WorldService } = require('./service');

const resourceName = GetCurrentResourceName();
const runtime = {
  resourcePath: GetResourcePath(resourceName),
  loadResourceFile(relativePath) {
    return LoadResourceFile(resourceName, relativePath);
  },
  emitClient(source, eventName, ...args) {
    emitNet(eventName, source, ...args);
  },
  getPosition(source) {
    const ped = Number(GetPlayerPed(String(source)));
    if (!ped) return null;
    const value = GetEntityCoords(ped);
    return {
      x: Number(value?.x ?? value?.[0]),
      y: Number(value?.y ?? value?.[1]),
      z: Number(value?.z ?? value?.[2]),
    };
  },
  modelHash(model) {
    return Number(GetHashKey(model));
  },
  log(level, message) {
    const output = `[fluxcore_world] [${level}] ${message}`;
    if (level === 'error') console.error(output);
    else if (level === 'warn') console.warn(output);
    else console.log(output);
  },
};

function requireResource(name) {
  if (GetResourceState(name) !== 'started') {
    throw worldError('INTEGRATION_UNAVAILABLE', `${name} must be started`);
  }
}

const integrations = {
  core: {
    getPlayerData(identifier) {
      return globalThis.exports.fluxcore_core.GetPlayerData(identifier);
    },
    getPlayerSource(characterId) {
      return globalThis.exports.fluxcore_core.GetPlayerSource(characterId);
    },
    getPlayers() {
      return globalThis.exports.fluxcore_core.GetPlayers();
    },
    addMoney(identifier, currency, amount, reason, reference) {
      return globalThis.exports.fluxcore_core.AddMoney(
        identifier,
        currency,
        amount,
        reason,
        reference,
      );
    },
    removeMoney(identifier, currency, amount, reason, reference) {
      return globalThis.exports.fluxcore_core.RemoveMoney(
        identifier,
        currency,
        amount,
        reason,
        reference,
      );
    },
  },
  jobs: {
    hasPermission(identifier, permission, options) {
      requireResource('fluxcore_jobs');
      return globalThis.exports.fluxcore_jobs.HasPermission(
        identifier,
        permission,
        options,
      );
    },
  },
  inventory: {
    canCarryItem(identifier, item, amount) {
      requireResource('fluxcore_inventory');
      return globalThis.exports.fluxcore_inventory.CanCarryItem(
        identifier,
        item,
        amount,
      );
    },
    addItem(identifier, item, amount, metadata) {
      requireResource('fluxcore_inventory');
      return globalThis.exports.fluxcore_inventory.AddItem(
        identifier,
        item,
        amount,
        metadata,
      );
    },
  },
  vehicles: {
    registerOwnedVehicle(identifier, details) {
      requireResource('fluxcore_vehicles');
      return globalThis.exports.fluxcore_vehicles.RegisterOwnedVehicle(identifier, {
        ...details,
        modelHash: runtime.modelHash(details.model),
      });
    },
  },
};

const config = loadConfig(runtime);
const database = new WorldDatabase(config.databaseFile);
const world = new WorldService(database, config, integrations, runtime);
const requests = new Map();

function result(work) {
  try {
    return { ok: true, data: work() };
  } catch (error) {
    if (error instanceof WorldError) {
      return { ok: false, error: { code: error.code, message: error.message } };
    }
    runtime.log('error', error?.stack || String(error));
    return {
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'the world resource could not complete the operation',
      },
    };
  }
}

function allow(source) {
  const now = Date.now();
  const cutoff = now - config.requestWindowMs;
  const history = (requests.get(source) || []).filter((entry) => entry > cutoff);
  if (history.length >= config.requestLimit) {
    requests.set(source, history);
    return false;
  }
  history.push(now);
  requests.set(source, history);
  return true;
}

onNet('fluxcore_world:server:request', (requestId, method, payload) => {
  const source = Number(global.source);
  const input =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? payload
      : {};
  const currentPosition = runtime.getPosition(source);
  const response = allow(source)
    ? result(() => {
        switch (String(method || '')) {
          case 'bootstrap':
            return world.publish(source);
          case 'shop:buy':
            return world.buyItem(
              source,
              input.shopId,
              input.item,
              input.quantity,
              currentPosition,
            );
          case 'dealership:buy':
            return world.buyVehicle(
              source,
              input.dealershipId,
              input.model,
              currentPosition,
            );
          case 'door:set':
            return world.setDoorLocked(
              source,
              input.doorId,
              input.locked,
              currentPosition,
            );
          default:
            throw worldError('ACTION_NOT_FOUND', 'world action was not found');
        }
      })
    : {
        ok: false,
        error: { code: 'RATE_LIMITED', message: 'too many world requests' },
      };
  runtime.emitClient(
    source,
    'fluxcore_world:client:response',
    String(requestId || '').slice(0, 96),
    response,
  );
});

on('Fluxcore:server:playerLoaded', (source) => {
  result(() => world.publish(Number(source)));
});
on('Fluxcore:server:jobUpdated', (source) => {
  result(() => world.publish(Number(source)));
});
on('playerDropped', () => {
  requests.delete(Number(global.source));
});

globalThis.exports('GetWorld', (identifier) =>
  result(() => world.snapshot(identifier)),
);
globalThis.exports(
  'BuyItem',
  (identifier, shopId, item, quantity, coordinates) =>
    result(() =>
      world.buyItem(identifier, shopId, item, quantity, coordinates),
    ),
);
globalThis.exports(
  'BuyVehicle',
  (identifier, dealershipId, model, coordinates) =>
    result(() =>
      world.buyVehicle(identifier, dealershipId, model, coordinates),
    ),
);
globalThis.exports(
  'SetDoorLocked',
  (identifier, doorId, locked, coordinates) =>
    result(() =>
      world.setDoorLocked(identifier, doorId, locked, coordinates),
    ),
);

on('onResourceStop', (stoppedResource) => {
  if (stoppedResource === resourceName) database.close();
});

runtime.log(
  'info',
  `started with ${Object.keys(config.shops).length} shops, ` +
    `${Object.keys(config.dealerships).length} dealerships, and ` +
    `${Object.keys(config.doors).length} doors`,
);
