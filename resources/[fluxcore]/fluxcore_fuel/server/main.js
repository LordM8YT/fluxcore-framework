'use strict';

const { FuelError } = require('./errors');
const { loadConfig } = require('./config');
const { FuelService } = require('./service');

const resourceName = GetCurrentResourceName();
const runtime = {
  loadResourceFile(relativePath) {
    return LoadResourceFile(resourceName, relativePath);
  },
  emitClient(source, eventName, ...args) {
    emitNet(eventName, source, ...args);
  },
  playerPed(source) {
    const ped = Number(GetPlayerPed(String(source)));
    if (!Number.isSafeInteger(ped) || ped <= 0) {
      throw new FuelError('PLAYER_PED_MISSING', 'player ped is unavailable');
    }
    return ped;
  },
  vehicleFromNetwork(networkId) {
    const id = Number(networkId);
    const vehicle = Number(NetworkGetEntityFromNetworkId(id));
    if (
      !Number.isSafeInteger(id) ||
      id <= 0 ||
      !Number.isSafeInteger(vehicle) ||
      vehicle <= 0 ||
      !DoesEntityExist(vehicle)
    ) {
      throw new FuelError('VEHICLE_NOT_FOUND', 'network vehicle was not found');
    }
    return vehicle;
  },
  entityType(entity) {
    return Number(GetEntityType(entity));
  },
  driver(vehicle) {
    return Number(GetPedInVehicleSeat(vehicle, -1));
  },
  entityCoordinates(entity) {
    return GetEntityCoords(entity);
  },
  canCarryItem(source, itemName, amount) {
    return globalThis.exports.fluxcore_inventory.CanCarryItem(
      source,
      itemName,
      amount,
    );
  },
  addItem(source, itemName, amount, metadata) {
    return globalThis.exports.fluxcore_inventory.AddItem(
      source,
      itemName,
      amount,
      metadata,
    );
  },
  removeItem(source, itemName, amount) {
    return globalThis.exports.fluxcore_inventory.RemoveItem(
      source,
      itemName,
      amount,
      undefined,
    );
  },
  log(level, message) {
    const output = `[fluxcore_fuel] [${level}] ${message}`;
    if (level === 'error') {
      console.error(output);
    } else if (level === 'warn') {
      console.warn(output);
    } else {
      console.log(output);
    }
  },
};

const core = {
  getPlayerData(identifier) {
    return globalThis.exports.fluxcore_core.GetPlayerData(identifier);
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
  addMoney(identifier, currency, amount, reason, reference) {
    return globalThis.exports.fluxcore_core.AddMoney(
      identifier,
      currency,
      amount,
      reason,
      reference,
    );
  },
};

const config = loadConfig(runtime);
const fuel = new FuelService(config, core, runtime);
const requests = new Map();

function result(work) {
  try {
    return { ok: true, data: work() };
  } catch (error) {
    if (error instanceof FuelError) {
      return {
        ok: false,
        error: { code: error.code, message: error.message },
      };
    }
    runtime.log('error', error?.stack || String(error));
    return {
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'the fuel resource could not complete the operation',
      },
    };
  }
}

function allow(source) {
  const now = Date.now();
  const cutoff = now - config.requestWindowMs;
  const history = (requests.get(source) || []).filter(
    (timestamp) => timestamp > cutoff,
  );
  if (history.length >= config.requestLimit) {
    requests.set(source, history);
    return false;
  }
  history.push(now);
  requests.set(source, history);
  return true;
}

onNet('fluxcore_fuel:server:purchase', (networkId, stationId, liters) => {
  const source = Number(global.source);
  const response = allow(source)
    ? result(() => fuel.purchase(source, networkId, stationId, liters))
    : {
        ok: false,
        error: { code: 'RATE_LIMITED', message: 'too many fuel requests' },
      };
  runtime.emitClient(source, 'fluxcore_fuel:client:purchaseResult', response);
});

onNet('fluxcore_fuel:server:buyCan', (stationId) => {
  const source = Number(global.source);
  const response = allow(source)
    ? result(() => fuel.buyCan(source, stationId))
    : {
        ok: false,
        error: { code: 'RATE_LIMITED', message: 'too many fuel requests' },
      };
  runtime.emitClient(source, 'fluxcore_fuel:client:canPurchased', response);
});

onNet('fluxcore_fuel:server:useCan', (networkId) => {
  const source = Number(global.source);
  const response = allow(source)
    ? result(() => fuel.useCan(source, networkId))
    : {
        ok: false,
        error: { code: 'RATE_LIMITED', message: 'too many fuel requests' },
      };
  runtime.emitClient(source, 'fluxcore_fuel:client:purchaseResult', response);
});

const canRegistration = globalThis.exports.fluxcore_inventory.RegisterUsableItem(
  'fuel_can',
  (source) => {
    runtime.emitClient(Number(source), 'fluxcore_fuel:client:equipCan');
    return { consume: 0 };
  },
);
if (!canRegistration?.ok) {
  runtime.log(
    'warn',
    canRegistration?.error?.message || 'fuel can could not be registered',
  );
}

globalThis.exports('PurchaseFuel', (source, networkId, stationId, liters) =>
  result(() => fuel.purchase(Number(source), networkId, stationId, liters)),
);

on('playerDropped', () => {
  requests.delete(Number(global.source));
});

runtime.log(
  'info',
  `started with ${Object.keys(config.stations).length} fuel stations`,
);
