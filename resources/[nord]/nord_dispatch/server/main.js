'use strict';

const { DispatchDatabase } = require('./database');
const { DispatchError, dispatchError } = require('./errors');
const { loadConfig } = require('./config');
const { DispatchService } = require('./service');

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
    if (!ped) {
      return null;
    }
    const coordinates = GetEntityCoords(ped);
    return {
      x: Number(coordinates?.x ?? coordinates?.[0]),
      y: Number(coordinates?.y ?? coordinates?.[1]),
      z: Number(coordinates?.z ?? coordinates?.[2]),
    };
  },
  log(level, message) {
    const output = `[varde_dispatch] [${level}] ${message}`;
    if (level === 'error') console.error(output);
    else if (level === 'warn') console.warn(output);
    else console.log(output);
  },
};

function requireResource(name) {
  if (GetResourceState(name) !== 'started') {
    throw dispatchError('INTEGRATION_UNAVAILABLE', `${name} must be started`);
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
    getPlayers() {
      return globalThis.exports.varde_core.GetPlayers();
    },
  },
  jobs: {
    hasPermission(identifier, permission, options) {
      requireResource('varde_jobs');
      return globalThis.exports.varde_jobs.HasPermission(
        identifier,
        permission,
        options,
      );
    },
  },
  services: {
    getRoster() {
      requireResource('varde_services');
      return globalThis.exports.varde_services.GetRoster();
    },
  },
};

const config = loadConfig(runtime);
const database = new DispatchDatabase(config.databaseFile);
const dispatch = new DispatchService(database, config, integrations, runtime);
const requests = new Map();

function result(work) {
  try {
    return { ok: true, data: work() };
  } catch (error) {
    if (error instanceof DispatchError) {
      return { ok: false, error: { code: error.code, message: error.message } };
    }
    runtime.log('error', error?.stack || String(error));
    return {
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'the dispatch resource could not complete the operation',
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

onNet('varde_dispatch:server:request', (requestId, method, payload) => {
  const source = Number(global.source);
  const input =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? payload
      : {};
  const response = allow(source)
    ? result(() => {
        switch (String(method || '')) {
          case 'bootstrap':
            return dispatch.publish(source);
          case 'call:create':
            return dispatch.create(
              source,
              input.service,
              input.description,
              runtime.getPosition(source),
              { title: input.title },
            );
          case 'call:assign':
            return dispatch.assign(source, input.callId);
          case 'call:unassign':
            return dispatch.unassign(source, input.callId);
          case 'call:close':
            return dispatch.closeCall(source, input.callId);
          default:
            throw dispatchError('ACTION_NOT_FOUND', 'dispatch action was not found');
        }
      })
    : {
        ok: false,
        error: { code: 'RATE_LIMITED', message: 'too many dispatch requests' },
      };
  runtime.emitClient(
    source,
    'varde_dispatch:client:response',
    String(requestId || '').slice(0, 96),
    response,
  );
});

on('varde:server:playerLoaded', (source) => {
  result(() => dispatch.publish(Number(source)));
});
on('varde:server:jobUpdated', (source) => {
  result(() => dispatch.publish(Number(source)));
});
on('varde:server:characterDeleted', (_source, characterId) => {
  result(() => dispatch.deleteCharacter(characterId));
});
on('playerDropped', () => {
  requests.delete(Number(global.source));
});

globalThis.exports(
  'CreateCall',
  (identifier, service, description, coordinates, options) =>
    result(() =>
      dispatch.create(identifier, service, description, coordinates, options),
    ),
);
globalThis.exports('GetCall', (identifier, id) =>
  result(() => dispatch.get(identifier, id)),
);
globalThis.exports('GetDispatch', (identifier) =>
  result(() => dispatch.snapshot(identifier)),
);
globalThis.exports('AssignUnit', (identifier, id) =>
  result(() => dispatch.assign(identifier, id)),
);
globalThis.exports('UnassignUnit', (identifier, id) =>
  result(() => dispatch.unassign(identifier, id)),
);
globalThis.exports('CloseCall', (identifier, id) =>
  result(() => dispatch.closeCall(identifier, id)),
);

on('onResourceStop', (stoppedResource) => {
  if (stoppedResource === resourceName) database.close();
});

runtime.log(
  'info',
  `started with ${Object.keys(config.services).length} dispatch services`,
);
