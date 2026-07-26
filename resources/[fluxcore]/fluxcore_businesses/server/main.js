'use strict';

const { BusinessesDatabase } = require('./database');
const { BusinessesError, businessesError } = require('./errors');
const { loadConfig } = require('./config');
const { BusinessesService } = require('./service');

const resourceName = GetCurrentResourceName();
const runtime = {
  resourcePath: GetResourcePath(resourceName),
  loadResourceFile(relativePath) {
    return LoadResourceFile(resourceName, relativePath);
  },
  emitClient(source, eventName, ...args) {
    emitNet(eventName, source, ...args);
  },
  setPlayerState(source, key, value, replicated) {
    Player(String(source)).state.set(key, value, replicated);
  },
  log(level, message) {
    const output = `[fluxcore_businesses] [${level}] ${message}`;
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
  getPlayerSource(characterId) {
    return globalThis.exports.fluxcore_core.GetPlayerSource(characterId);
  },
};

const config = loadConfig(runtime);
const database = new BusinessesDatabase(config.databaseFile);
const businesses = new BusinessesService(database, config, core, runtime);
const requests = new Map();

function result(work) {
  try {
    return { ok: true, data: work() };
  } catch (error) {
    if (error instanceof BusinessesError) {
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
        message: 'the businesses resource could not complete the operation',
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

function respond(source, requestId, work) {
  const response = allow(source)
    ? result(work)
    : {
        ok: false,
        error: { code: 'RATE_LIMITED', message: 'too many business requests' },
      };
  runtime.emitClient(
    source,
    'fluxcore_businesses:client:response',
    String(requestId || '').slice(0, 96),
    response,
  );
}

function actor(source) {
  return Number(source) === 0 ? 'console' : `source:${Number(source)}`;
}

onNet('fluxcore_businesses:server:request', (requestId, method, payload) => {
  const source = Number(global.source);
  const input =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? payload
      : {};
  respond(source, requestId, () => {
    switch (String(method || '')) {
      case 'bootstrap':
        return businesses.publish(source);
      case 'setActive':
        return businesses.setActive(source, input.businessId);
      case 'addMember': {
        const target = core.getPlayerData(Number(input.targetSource));
        if (!target?.characterId) {
          throw businessesError('PLAYER_NOT_FOUND', 'online target was not found');
        }
        return businesses.addMember(
          source,
          input.businessId,
          target.characterId,
          input.role,
          actor(source),
        );
      }
      case 'removeMember':
        return businesses.removeMember(
          source,
          input.businessId,
          input.characterId,
          actor(source),
        );
      case 'ledger':
        return businesses.ledger(source, input.businessId, input.limit);
      default:
        throw businessesError(
          'ACTION_NOT_FOUND',
          'business action was not found',
        );
    }
  });
});

on('Fluxcore:server:playerLoaded', (source) => {
  result(() => businesses.publish(Number(source)));
});

on('Fluxcore:server:characterDeleted', (_source, characterId) => {
  result(() => businesses.deleteCharacter(characterId));
});

on('playerDropped', () => {
  requests.delete(Number(global.source));
});

RegisterCommand(
  'createbusiness',
  (source, args) => {
    if (
      Number(source) !== 0 &&
      !IsPlayerAceAllowed(String(source), 'Fluxcore.businesses.manage')
    ) {
      runtime.emitClient(
        Number(source),
        'fluxcore_businesses:client:message',
        'You do not have permission to create businesses.',
        'error',
      );
      return;
    }
    const owner = Number(args[0]);
    const type = args[1];
    const name = args.slice(2).join(' ');
    const response = result(() =>
      businesses.create(owner, type, name, actor(source)),
    );
    if (!response.ok) {
      runtime.log('error', response.error.message);
    }
  },
  false,
);

globalThis.exports('GetBusiness', (id) =>
  result(() => businesses.get(id)),
);
globalThis.exports('GetBusinesses', (identifier) =>
  result(() => businesses.list(identifier)),
);
globalThis.exports('HasPermission', (identifier, id, permission) =>
  businesses.hasPermission(identifier, id, permission),
);
globalThis.exports('CreateBusiness', (owner, type, name) =>
  result(() =>
    businesses.create(
      owner,
      type,
      name,
      GetInvokingResource() || 'resource',
    ),
  ),
);
globalThis.exports('AddMember', (actorIdentifier, id, targetId, role) =>
  result(() =>
    businesses.addMember(
      actorIdentifier,
      id,
      targetId,
      role,
      GetInvokingResource() || 'resource',
    ),
  ),
);
globalThis.exports('RemoveMember', (actorIdentifier, id, targetId) =>
  result(() =>
    businesses.removeMember(
      actorIdentifier,
      id,
      targetId,
      GetInvokingResource() || 'resource',
    ),
  ),
);
globalThis.exports('CreditTreasury', (id, amount, reason, reference) =>
  result(() =>
    businesses.changeTreasury(
      id,
      amount,
      'credit',
      reason,
      reference,
      GetInvokingResource() || 'resource',
    ),
  ),
);
globalThis.exports('DebitTreasury', (id, amount, reason, reference) =>
  result(() =>
    businesses.changeTreasury(
      id,
      amount,
      'debit',
      reason,
      reference,
      GetInvokingResource() || 'resource',
    ),
  ),
);

on('onResourceStop', (stoppedResource) => {
  if (stoppedResource === resourceName) {
    database.close();
  }
});

runtime.log(
  'info',
  `started with ${Object.keys(config.types).length} business types`,
);
