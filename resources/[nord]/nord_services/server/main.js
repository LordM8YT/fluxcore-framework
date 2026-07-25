'use strict';

const { ServicesDatabase } = require('./database');
const { ServicesError, servicesError } = require('./errors');
const { loadConfig } = require('./config');
const { ServicesService } = require('./service');

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
    const output = `[varde_services] [${level}] ${message}`;
    if (level === 'error') {
      console.error(output);
    } else if (level === 'warn') {
      console.warn(output);
    } else {
      console.log(output);
    }
  },
};

function requireResource(name) {
  if (GetResourceState(name) !== 'started') {
    throw servicesError(
      'INTEGRATION_UNAVAILABLE',
      `${name} must be started`,
    );
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
    transferMoney(from, to, currency, amount, reason, reference) {
      return globalThis.exports.varde_core.TransferMoney(
        from,
        to,
        currency,
        amount,
        reason,
        reference,
      );
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
  businesses: {
    hasPermission(identifier, businessId, permission) {
      requireResource('varde_businesses');
      return globalThis.exports.varde_businesses.HasPermission(
        identifier,
        businessId,
        permission,
      );
    },
    creditTreasury(businessId, amount, reason, reference) {
      requireResource('varde_businesses');
      return globalThis.exports.varde_businesses.CreditTreasury(
        businessId,
        amount,
        reason,
        reference,
      );
    },
  },
};

const config = loadConfig(runtime);
const database = new ServicesDatabase(config.databaseFile);
const services = new ServicesService(
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
    if (error instanceof ServicesError) {
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
        message: 'the services resource could not complete the operation',
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

onNet('varde_services:server:request', (requestId, method, payload) => {
  const source = Number(global.source);
  const input =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? payload
      : {};
  const response = allow(source)
    ? result(() => {
        switch (String(method || '')) {
          case 'bootstrap':
            return services.publish(source);
          case 'invoice:create':
            return services.createInvoice(
              source,
              input.service,
              Number(input.targetSource),
              input.amount,
              input.description,
              input.businessId,
            );
          case 'invoice:pay':
            return services.pay(source, input.invoiceId);
          case 'invoice:cancel':
            return services.cancel(source, input.invoiceId);
          default:
            throw servicesError(
              'ACTION_NOT_FOUND',
              'service action was not found',
            );
        }
      })
    : {
        ok: false,
        error: { code: 'RATE_LIMITED', message: 'too many service requests' },
      };
  runtime.emitClient(
    source,
    'varde_services:client:response',
    String(requestId || '').slice(0, 96),
    response,
  );
});

on('varde:server:playerLoaded', (source) => {
  result(() => services.publish(Number(source)));
});
on('varde:server:jobUpdated', (source) => {
  result(() => services.publish(Number(source)));
});
on('varde:server:characterDeleted', (_source, characterId) => {
  result(() => services.deleteCharacter(characterId));
});
on('playerDropped', () => {
  requests.delete(Number(global.source));
});

globalThis.exports(
  'CreateInvoice',
  (issuer, service, recipient, amount, description, businessId) =>
    result(() =>
      services.createInvoice(
        issuer,
        service,
        recipient,
        amount,
        description,
        businessId,
      ),
    ),
);
globalThis.exports('GetInvoice', (id) =>
  result(() => services.getInvoice(id)),
);
globalThis.exports('GetInvoices', (identifier) =>
  result(() => services.snapshot(identifier)),
);
globalThis.exports('PayInvoice', (identifier, id) =>
  result(() => services.pay(identifier, id)),
);
globalThis.exports('CancelInvoice', (identifier, id) =>
  result(() => services.cancel(identifier, id)),
);
globalThis.exports('GetRoster', () => services.roster());

on('onResourceStop', (stoppedResource) => {
  if (stoppedResource === resourceName) {
    database.close();
  }
});

runtime.log(
  'info',
  `started with ${Object.keys(config.services).length} service definitions`,
);
