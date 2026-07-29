'use strict';

const { StatusDatabase } = require('./database');
const { StatusError } = require('./errors');
const { loadConfig } = require('./config');
const { StatusService } = require('./service');

const resourceName = GetCurrentResourceName();
const runtime = {
  resourcePath: GetResourcePath(resourceName),
  loadResourceFile(relativePath) {
    return LoadResourceFile(resourceName, relativePath);
  },
  emitClient(source, eventName, ...args) {
    emitNet(eventName, source, ...args);
  },
  log(level, message) {
    const output = `[fluxcore_status] [${level}] ${message}`;
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
  getPlayers() {
    return globalThis.exports.fluxcore_core.GetPlayers();
  },
  getPlayerSource(characterId) {
    return globalThis.exports.fluxcore_core.GetPlayerSource(characterId);
  },
};

const config = loadConfig(runtime);
const database = new StatusDatabase(config.databaseFile);
const status = new StatusService(database, config, core, runtime);
const requestTimes = new Map();

function registerConsumables() {
  if (GetResourceState('fluxcore_inventory') !== 'started') {
    return false;
  }
  let registered = 0;
  for (const [itemName, effect] of Object.entries(config.consumables)) {
    const response = globalThis.exports.fluxcore_inventory.RegisterUsableItem(
      itemName,
      (source) => {
        const playerSource = Number(source);
        if (effect.status) {
          const current = status.get(playerSource);
          const definition = config.needs[effect.status];
          if (current[effect.status] >= definition.maximum) {
            return false;
          }
        }
        return {
          consume: 1,
          afterUse() {
            if (effect.status) {
              status.add(playerSource, effect.status, effect.amount);
            } else if (effect.heal) {
              runtime.emitClient(
                playerSource,
                'fluxcore_status:client:heal',
                effect.heal,
              );
            }
          },
        };
      },
    );
    if (response?.ok) {
      registered += 1;
    } else {
      runtime.log(
        'warn',
        response?.error?.message || `could not register usable item ${itemName}`,
      );
    }
  }
  runtime.log('info', `registered ${registered} status consumables`);
  return registered === Object.keys(config.consumables).length;
}

function result(work) {
  try {
    return { ok: true, data: work() };
  } catch (error) {
    if (error instanceof StatusError) {
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
        message: 'the status resource could not complete the operation',
      },
    };
  }
}

function sync(source) {
  const response = result(() => status.sync(Number(source)));
  if (!response.ok) {
    runtime.log('warn', `could not sync source ${source}: ${response.error.message}`);
  }
  return response;
}

on('Fluxcore:server:playerLoaded', (source) => {
  sync(source);
});

on('Fluxcore:server:playerLoggedOut', (source, characterId) => {
  status.drop(source, characterId);
});

on('Fluxcore:server:playerDropped', (source, characterId) => {
  status.drop(source, characterId);
});

on('Fluxcore:server:characterDeleted', (_source, characterId) => {
  status.deleteCharacter(characterId);
});

onNet('fluxcore_status:server:request', () => {
  const source = Number(global.source);
  const now = Date.now();
  const previous = requestTimes.get(source) || 0;
  if (now - previous >= 1_000) {
    requestTimes.set(source, now);
    sync(source);
  }
});

globalThis.exports('GetStatus', (identifier) => {
  try {
    return status.get(identifier);
  } catch {
    return null;
  }
});
globalThis.exports('SetStatus', (identifier, name, value) =>
  result(() => status.set(identifier, name, value)),
);
globalThis.exports('AddStatus', (identifier, name, amount) =>
  result(() => status.add(identifier, name, amount)),
);
globalThis.exports('RemoveStatus', (identifier, name, amount) =>
  result(() => status.remove(identifier, name, amount)),
);
globalThis.exports('ResetStatus', (identifier) =>
  result(() => status.reset(identifier)),
);

const tickTimer = setInterval(() => {
  try {
    status.tick();
  } catch (error) {
    runtime.log('error', error?.stack || String(error));
  }
}, config.tickIntervalMs);

setTimeout(() => {
  registerConsumables();
  for (const player of core.getPlayers()) {
    sync(player.source);
  }
}, 0);

on('onResourceStart', (startedResource) => {
  if (startedResource === 'fluxcore_inventory') {
    setTimeout(registerConsumables, 0);
  }
});

on('playerDropped', () => {
  const source = Number(global.source);
  status.drop(source);
  requestTimes.delete(source);
});

on('onResourceStop', (stoppedResource) => {
  if (stoppedResource !== resourceName) {
    return;
  }
  clearInterval(tickTimer);
  database.close();
});

runtime.log(
  'info',
  `started with ${Object.keys(config.needs).length} persistent needs`,
);
