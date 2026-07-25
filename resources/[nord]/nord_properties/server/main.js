'use strict';

const { PropertiesDatabase } = require('./database');
const { PropertiesError, propertiesError } = require('./errors');
const { loadConfig } = require('./config');
const { PropertiesService } = require('./service');

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
  log(level, message) {
    const output = `[varde_properties] [${level}] ${message}`;
    if (level === 'error') console.error(output);
    else if (level === 'warn') console.warn(output);
    else console.log(output);
  },
};

function requireResource(name) {
  if (GetResourceState(name) !== 'started') {
    throw propertiesError('INTEGRATION_UNAVAILABLE', `${name} must be started`);
  }
}

const integrations = {
  core: {
    getPlayerData(identifier) {
      return globalThis.exports.varde_core.GetPlayerData(identifier);
    },
    getPlayerSource(characterId) {
      return globalThis.exports.varde_core.GetPlayerSource(characterId);
    },
    getCharacterData(identifier) {
      return globalThis.exports.varde_core.GetCharacterData(identifier);
    },
    addMoney(identifier, currency, amount, reason, reference) {
      return globalThis.exports.varde_core.AddMoney(
        identifier,
        currency,
        amount,
        reason,
        reference,
      );
    },
    removeMoney(identifier, currency, amount, reason, reference) {
      return globalThis.exports.varde_core.RemoveMoney(
        identifier,
        currency,
        amount,
        reason,
        reference,
      );
    },
  },
  inventory: {
    registerStash(id, label, slots, maxWeight) {
      requireResource('varde_inventory');
      return globalThis.exports.varde_inventory.RegisterStash(
        id,
        label,
        slots,
        maxWeight,
      );
    },
    openInventory(source, id) {
      requireResource('varde_inventory');
      return globalThis.exports.varde_inventory.OpenInventory(source, id);
    },
  },
};

const config = loadConfig(runtime);
const database = new PropertiesDatabase(config.databaseFile);
const properties = new PropertiesService(
  database,
  config,
  integrations,
  runtime,
);
const requests = new Map();

function result(work) {
  try {
    return { ok: true, data: work() };
  } catch (error) {
    if (error instanceof PropertiesError) {
      return { ok: false, error: { code: error.code, message: error.message } };
    }
    runtime.log('error', error?.stack || String(error));
    return {
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'the properties resource could not complete the operation',
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

onNet('varde_properties:server:request', (requestId, method, payload) => {
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
            return properties.publish(source);
          case 'purchase':
            return properties.purchase(source, input.propertyId, currentPosition);
          case 'key:give':
            return properties.giveKey(
              source,
              input.propertyId,
              input.characterId,
              currentPosition,
            );
          case 'key:revoke':
            return properties.revokeKey(
              source,
              input.propertyId,
              input.characterId,
              currentPosition,
            );
          case 'lock:set':
            return properties.setLocked(
              source,
              input.propertyId,
              input.locked,
              currentPosition,
            );
          case 'storage:open':
            return properties.openStorage(
              source,
              input.propertyId,
              currentPosition,
            );
          default:
            throw propertiesError(
              'ACTION_NOT_FOUND',
              'property action was not found',
            );
        }
      })
    : {
        ok: false,
        error: { code: 'RATE_LIMITED', message: 'too many property requests' },
      };
  runtime.emitClient(
    source,
    'varde_properties:client:response',
    String(requestId || '').slice(0, 96),
    response,
  );
});

on('varde:server:playerLoaded', (source) => {
  result(() => properties.publish(Number(source)));
});
on('varde:server:characterDeleted', (_source, characterId) => {
  result(() => properties.deleteCharacter(characterId));
});
on('playerDropped', () => {
  requests.delete(Number(global.source));
});

globalThis.exports('GetProperties', (identifier) =>
  result(() => properties.snapshot(identifier)),
);
globalThis.exports('HasAccess', (identifier, propertyId) =>
  result(() => properties.hasAccess(identifier, propertyId)),
);
globalThis.exports('GiveKey', (identifier, propertyId, targetId, coordinates) =>
  result(() =>
    properties.giveKey(identifier, propertyId, targetId, coordinates),
  ),
);
globalThis.exports('RevokeKey', (identifier, propertyId, targetId, coordinates) =>
  result(() =>
    properties.revokeKey(identifier, propertyId, targetId, coordinates),
  ),
);

on('onResourceStop', (stoppedResource) => {
  if (stoppedResource === resourceName) database.close();
});

runtime.log(
  'info',
  `started with ${Object.keys(config.properties).length} properties`,
);
