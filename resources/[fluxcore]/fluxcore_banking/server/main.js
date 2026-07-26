'use strict';

const { BankingDatabase } = require('./database');
const { BankingError } = require('./errors');
const { loadConfig } = require('./config');
const { BankingService } = require('./service');

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
  coordinates(source) {
    const ped = GetPlayerPed(String(source));
    if (!ped) {
      return null;
    }
    const value = GetEntityCoords(ped);
    return {
      x: Number(value[0] ?? value.x),
      y: Number(value[1] ?? value.y),
      z: Number(value[2] ?? value.z),
    };
  },
  log(level, message) {
    const output = `[fluxcore_banking] [${level}] ${message}`;
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
  getMoney(identifier, currency) {
    return globalThis.exports.fluxcore_core.GetMoney(identifier, currency);
  },
  getMoneyLedger(identifier, currency, limit) {
    return globalThis.exports.fluxcore_core.GetMoneyLedger(
      identifier,
      currency,
      limit,
    );
  },
  moveMoney(identifier, fromCurrency, toCurrency, amount, reason, reference) {
    return globalThis.exports.fluxcore_core.MoveMoney(
      identifier,
      fromCurrency,
      toCurrency,
      amount,
      reason,
      reference,
    );
  },
  transferMoney(
    fromIdentifier,
    toIdentifier,
    currency,
    amount,
    reason,
    reference,
  ) {
    return globalThis.exports.fluxcore_core.TransferMoney(
      fromIdentifier,
      toIdentifier,
      currency,
      amount,
      reason,
      reference,
    );
  },
};

const config = loadConfig(runtime);
const database = new BankingDatabase(config.databaseFile);
const banking = new BankingService(database, config, core, runtime);
const requests = new Map();

function result(work) {
  try {
    return { ok: true, data: work() };
  } catch (error) {
    if (error instanceof BankingError) {
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
        message: 'the banking resource could not complete the operation',
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
        error: { code: 'RATE_LIMITED', message: 'too many banking requests' },
      };
  runtime.emitClient(
    source,
    'fluxcore_banking:client:response',
    String(requestId || '').slice(0, 96),
    response,
  );
  return response;
}

onNet(
  'fluxcore_banking:server:request',
  (requestId, method, payload) => {
    const source = Number(global.source);
    const input =
      payload && typeof payload === 'object' && !Array.isArray(payload)
        ? payload
        : {};
    respond(source, requestId, () => {
      const coordinates = runtime.coordinates(source);
      switch (String(method || '')) {
        case 'bootstrap':
          banking.requireAccess(coordinates);
          return banking.publish(source);
        case 'deposit':
          return banking.deposit(source, input.amount, coordinates);
        case 'withdraw':
          return banking.withdraw(source, input.amount, coordinates);
        case 'transfer':
          return banking.transfer(
            source,
            input.accountNumber,
            input.amount,
            input.memo,
            coordinates,
          );
        default:
          throw new BankingError(
            'ACTION_NOT_FOUND',
            'banking action was not found',
          );
      }
    });
  },
);

on('Fluxcore:server:playerLoaded', (source) => {
  result(() => banking.publish(Number(source)));
});

on('Fluxcore:server:characterDeleted', (_source, characterId) => {
  result(() => banking.deleteCharacter(characterId));
});

on('playerDropped', () => {
  requests.delete(Number(global.source));
});

globalThis.exports('GetAccount', (identifier) =>
  result(() => banking.ensure(identifier)),
);
globalThis.exports('ResolveAccount', (accountNumber) =>
  result(() => banking.profileByAccount(accountNumber)),
);
globalThis.exports('GetBalance', (identifier) =>
  result(() => banking.balance(identifier)),
);
globalThis.exports('Deposit', (identifier, amount) =>
  result(() => banking.deposit(identifier, amount, null, true)),
);
globalThis.exports('Withdraw', (identifier, amount) =>
  result(() => banking.withdraw(identifier, amount, null, true)),
);
globalThis.exports(
  'Transfer',
  (identifier, accountNumber, amount, memo) =>
    result(() =>
      banking.transfer(
        identifier,
        accountNumber,
        amount,
        memo,
        null,
        true,
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
  `started with ${config.accessPoints.length} access points and ${database.count()} accounts`,
);
