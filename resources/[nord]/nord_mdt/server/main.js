'use strict';

const { MdtDatabase } = require('./database');
const { MdtError, mdtError } = require('./errors');
const { loadConfig } = require('./config');
const { MdtService } = require('./service');

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
    const output = `[nord_mdt] [${level}] ${message}`;
    if (level === 'error') console.error(output);
    else if (level === 'warn') console.warn(output);
    else console.log(output);
  },
};

function requireResource(name) {
  if (GetResourceState(name) !== 'started') {
    throw mdtError('INTEGRATION_UNAVAILABLE', `${name} must be started`);
  }
}

const integrations = {
  core: {
    getPlayerData(identifier) {
      return globalThis.exports.nord_core.GetPlayerData(identifier);
    },
    getPlayerSource(characterId) {
      return globalThis.exports.nord_core.GetPlayerSource(characterId);
    },
    getPlayers() {
      return globalThis.exports.nord_core.GetPlayers();
    },
    getCharacterData(identifier) {
      return globalThis.exports.nord_core.GetCharacterData(identifier);
    },
  },
  jobs: {
    hasPermission(identifier, permission, options) {
      requireResource('nord_jobs');
      return globalThis.exports.nord_jobs.HasPermission(
        identifier,
        permission,
        options,
      );
    },
  },
  vehicles: {
    getVehicles(identifier) {
      requireResource('nord_vehicles');
      return globalThis.exports.nord_vehicles.GetVehicles(identifier);
    },
  },
  dispatch: {
    getDispatch(identifier) {
      requireResource('nord_dispatch');
      return globalThis.exports.nord_dispatch.GetDispatch(identifier);
    },
  },
};

const config = loadConfig(runtime);
const database = new MdtDatabase(config.databaseFile);
const mdt = new MdtService(database, config, integrations, runtime);
const requests = new Map();

function result(work) {
  try {
    return { ok: true, data: work() };
  } catch (error) {
    if (error instanceof MdtError) {
      return { ok: false, error: { code: error.code, message: error.message } };
    }
    runtime.log('error', error?.stack || String(error));
    return {
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'the MDT resource could not complete the operation',
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

onNet('nord_mdt:server:request', (requestId, method, payload) => {
  const source = Number(global.source);
  const input =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? payload
      : {};
  const response = allow(source)
    ? result(() => {
        switch (String(method || '')) {
          case 'bootstrap':
            return mdt.dashboard(source);
          case 'people:search':
            return mdt.search(source, input.query);
          case 'profile:get':
            return mdt.profile(source, input.characterId);
          case 'report:create':
            return mdt.createReport(source, input);
          case 'warrant:create':
            return mdt.createWarrant(
              source,
              input.characterId,
              input.reason,
            );
          case 'warrant:close':
            return mdt.closeWarrant(source, input.warrantId);
          case 'bolo:create':
            return mdt.createBolo(
              source,
              input.type,
              input.value,
              input.reason,
            );
          case 'bolo:close':
            return mdt.closeBolo(source, input.boloId);
          default:
            throw mdtError('ACTION_NOT_FOUND', 'MDT action was not found');
        }
      })
    : {
        ok: false,
        error: { code: 'RATE_LIMITED', message: 'too many MDT requests' },
      };
  runtime.emitClient(
    source,
    'nord_mdt:client:response',
    String(requestId || '').slice(0, 96),
    response,
  );
});

on('Nord:server:characterDeleted', (_source, characterId) => {
  result(() => mdt.deleteCharacter(characterId));
});
on('playerDropped', () => {
  requests.delete(Number(global.source));
});

globalThis.exports('GetDashboard', (identifier) =>
  result(() => mdt.dashboard(identifier)),
);
globalThis.exports('SearchPeople', (identifier, query) =>
  result(() => mdt.search(identifier, query)),
);
globalThis.exports('GetProfile', (identifier, characterId) =>
  result(() => mdt.profile(identifier, characterId)),
);
globalThis.exports('CreateReport', (identifier, input) =>
  result(() => mdt.createReport(identifier, input)),
);
globalThis.exports('CreateWarrant', (identifier, subject, reason) =>
  result(() => mdt.createWarrant(identifier, subject, reason)),
);
globalThis.exports('CreateBolo', (identifier, type, value, reason) =>
  result(() => mdt.createBolo(identifier, type, value, reason)),
);

on('onResourceStop', (stoppedResource) => {
  if (stoppedResource === resourceName) database.close();
});

runtime.log('info', 'started');
