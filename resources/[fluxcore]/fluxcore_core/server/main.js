'use strict';

const { FrameworkDatabase } = require('./database');
const { FrameworkError } = require('./errors');
const { loadConfig } = require('./config');
const { CoreService } = require('./service');
const { RpcServer } = require('./rpc');
const { LocaleService } = require('./locale');

const resourceName = GetCurrentResourceName();

const runtime = {
  resourcePath: GetResourcePath(resourceName),
  loadResourceFile(relativePath) {
    return LoadResourceFile(resourceName, relativePath);
  },
  getConvarInt(name, fallback) {
    return GetConvarInt(name, fallback);
  },
  getConvar(name, fallback) {
    return GetConvar(name, fallback);
  },
  emitClient(source, eventName, ...args) {
    emitNet(eventName, source, ...args);
  },
  emitServer(eventName, ...args) {
    emit(eventName, ...args);
  },
  setPlayerState(source, key, value, replicated) {
    Player(String(source)).state.set(key, value, replicated);
  },
  log(level, message) {
    const output = `[fluxcore_core] [${level}] ${message}`;
    if (level === 'error') {
      console.error(output);
    } else if (level === 'warn') {
      console.warn(output);
    } else {
      console.log(output);
    }
  },
};

const config = loadConfig(runtime);
const locale = new LocaleService(runtime, config.locale, config.fallbackLocale);
const database = new FrameworkDatabase(config.databaseFile);
const core = new CoreService(database, config, runtime);
const rpc = new RpcServer(runtime);

function getIdentifiers(source) {
  const identifiers = [];
  const count = GetNumPlayerIdentifiers(String(source));
  for (let index = 0; index < count; index += 1) {
    const identifier = GetPlayerIdentifier(String(source), index);
    if (identifier && !identifier.startsWith('ip:')) {
      identifiers.push(identifier);
    }
  }
  return identifiers;
}

function primaryIdentifier(identifiers) {
  return (
    identifiers.find((identifier) => identifier.startsWith('license2:')) ||
    identifiers.find((identifier) => identifier.startsWith('license:')) ||
    null
  );
}

function prepareSource(source, displayName) {
  const identifiers = getIdentifiers(source);
  const identifier = primaryIdentifier(identifiers);
  return core.attachConnection(
    source,
    identifier,
    identifiers,
    displayName || GetPlayerName(String(source)) || 'unknown',
  );
}

function ensurePrepared(source) {
  try {
    core.requireContext(source);
  } catch (error) {
    if (!(error instanceof FrameworkError) || error.code !== 'NOT_READY') {
      throw error;
    }
    prepareSource(source);
  }
}

function exportResult(work) {
  try {
    return {
      ok: true,
      data: work(),
    };
  } catch (error) {
    if (error instanceof FrameworkError) {
      return {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
        },
      };
    }
    runtime.log('error', error?.stack || String(error));
    return {
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'the core could not complete the operation',
      },
    };
  }
}

rpc.register('characters:list', (source) => {
  ensurePrepared(source);
  return core.listCharacters(source);
});
rpc.register('characters:bootstrap', (source) => {
  ensurePrepared(source);
  return core.characterBootstrap(source);
});
rpc.register(
  'characters:create',
  (source, payload) => {
    ensurePrepared(source);
    return core.createCharacter(source, payload);
  },
  { limit: 3, windowMs: 60_000 },
);
rpc.register(
  'characters:delete',
  (source, payload) => {
    ensurePrepared(source);
    return core.deleteCharacter(
      source,
      payload.characterId,
      payload.confirmation,
    );
  },
  { limit: 2, windowMs: 60_000 },
);
rpc.register('characters:select', (source, payload) => {
  ensurePrepared(source);
  return core.selectCharacter(source, payload.characterId);
});
rpc.register('session:current', (source) => {
  ensurePrepared(source);
  return core.getPlayerData(source);
});
rpc.register('session:logout', (source) => core.logout(source), {
  limit: 3,
  windowMs: 10_000,
});

onNet('Fluxcore:server:rpc', (requestId, method, payload) => {
  rpc.handle(Number(global.source), requestId, method, payload);
});

onNet('Fluxcore:server:updatePosition', (position) => {
  const playerSource = Number(global.source);
  try {
    if (!rpc.rateLimiter.allow(`${playerSource}:position`, 8, 60_000)) {
      return;
    }
    core.updatePosition(playerSource, position);
  } catch (error) {
    if (!(error instanceof FrameworkError)) {
      runtime.log('error', error?.stack || String(error));
    }
  }
});

onNet('Fluxcore:server:spawnDiagnostics', (diagnostics) => {
  const playerSource = Number(global.source);
  if (!rpc.rateLimiter.allow(`${playerSource}:spawn-diagnostics`, 4, 60_000)) {
    return;
  }

  const input = diagnostics && typeof diagnostics === 'object' ? diagnostics : {};
  const position =
    input.position && typeof input.position === 'object' ? input.position : {};
  const report = {
    source: playerSource,
    model: Number(input.model) || 0,
    pedExists: input.pedExists === true,
    pedVisible: input.pedVisible === true,
    screenFadedIn: input.screenFadedIn === true,
    screenFadedOut: input.screenFadedOut === true,
    gameplayCamRendering: input.gameplayCamRendering === true,
    playerSwitchInProgress: input.playerSwitchInProgress === true,
    networkPlayerActive: input.networkPlayerActive === true,
    position: {
      x: Number(position.x) || 0,
      y: Number(position.y) || 0,
      z: Number(position.z) || 0,
    },
  };
  runtime.log('info', `spawn diagnostics ${JSON.stringify(report)}`);
});

on('playerConnecting', (name, _setKickReason, deferrals) => {
  const playerSource = Number(global.source);
  const identifiers = getIdentifiers(playerSource);
  const identifier = primaryIdentifier(identifiers);
  deferrals.defer();

  setTimeout(() => {
    try {
      deferrals.update(locale.get('core.connection.preparing'));
      core.attachConnection(
        playerSource,
        identifier,
        identifiers,
        name,
      );
      deferrals.done();
    } catch (error) {
      const message =
        error instanceof FrameworkError
          ? error.message
          : locale.get('core.connection.failed');
      runtime.log('error', error?.stack || String(error));
      deferrals.done(message);
    }
  }, 0);
});

on('playerJoining', (oldSource) => {
  core.moveSource(Number(oldSource), Number(global.source));
});

on('playerDropped', () => {
  const playerSource = Number(global.source);
  try {
    core.drop(playerSource);
  } catch (error) {
    runtime.log('error', error?.stack || String(error));
  } finally {
    rpc.drop(playerSource);
  }
});

globalThis.exports('GetPlayerData', (identifier) =>
  core.getPlayerData(identifier),
);
globalThis.exports('GetPlayer', (identifier) =>
  core.getPlayerData(identifier),
);
globalThis.exports('GetCharacterData', (identifier) =>
  exportResult(() => core.getCharacterData(identifier)),
);
globalThis.exports('Locale', (key, replacements, fallback) =>
  locale.get(key, replacements, fallback),
);
globalThis.exports('GetLocale', () => locale.locale);
globalThis.exports('GetLocaleData', (namespace) => locale.getData(namespace));
globalThis.exports('GetPlayers', () => core.getPlayers());
globalThis.exports('GetPlayerSource', (characterId) => {
  const player = core.getPlayer(characterId);
  return player ? player.source : 0;
});
globalThis.exports('GetMoney', (identifier, currency) =>
  exportResult(() => core.getMoney(identifier, currency)),
);
globalThis.exports('GetMoneyLedger', (identifier, currency, limit) =>
  exportResult(() => core.getMoneyLedger(identifier, currency, limit)),
);
globalThis.exports('DeleteCharacter', (source, characterId, confirmation) =>
  exportResult(() => {
    ensurePrepared(source);
    return core.deleteCharacter(source, characterId, confirmation);
  }),
);
globalThis.exports(
  'AddMoney',
  (identifier, currency, amount, reason, reference) =>
    exportResult(() =>
      core.changeMoney(
        identifier,
        currency,
        amount,
        'add',
        reason,
        reference,
        GetInvokingResource() || 'console',
      ),
    ),
);
globalThis.exports(
  'RemoveMoney',
  (identifier, currency, amount, reason, reference) =>
    exportResult(() =>
      core.changeMoney(
        identifier,
        currency,
        amount,
        'remove',
        reason,
        reference,
        GetInvokingResource() || 'console',
      ),
    ),
);
globalThis.exports(
  'SetMoney',
  (identifier, currency, amount, reason, reference) =>
    exportResult(() =>
      core.setMoney(
        identifier,
        currency,
        amount,
        reason,
        reference,
        GetInvokingResource() || 'console',
      ),
    ),
);
globalThis.exports(
  'MoveMoney',
  (identifier, fromCurrency, toCurrency, amount, reason, reference) =>
    exportResult(() =>
      core.moveMoney(
        identifier,
        fromCurrency,
        toCurrency,
        amount,
        reason,
        reference,
        GetInvokingResource() || 'resource',
      ),
    ),
);
globalThis.exports(
  'TransferMoney',
  (fromIdentifier, toIdentifier, currency, amount, reason, reference) =>
    exportResult(() =>
      core.transferMoney(
        fromIdentifier,
        toIdentifier,
        currency,
        amount,
        reason,
        reference,
        GetInvokingResource() || 'resource',
      ),
    ),
);
globalThis.exports('SetMetadata', (identifier, key, value) =>
  exportResult(() => core.setMetadata(identifier, key, value)),
);
globalThis.exports('SetJob', (identifier, job) =>
  exportResult(() => core.setJob(identifier, job)),
);
globalThis.exports('SavePlayer', (identifier) =>
  exportResult(() => core.save(identifier)),
);

const healthResources = [
  'fluxcore_core', 'fluxcore_voice', 'fluxcore_interact', 'fluxcore_jobs',
  'fluxcore_inventory', 'fluxcore_bridge', 'fluxcore_status', 'fluxcore_banking',
  'fluxcore_vehicles', 'fluxcore_fuel', 'fluxcore_appearance',
  'fluxcore_businesses', 'fluxcore_services', 'fluxcore_dispatch',
  'fluxcore_mdt', 'fluxcore_properties', 'fluxcore_world', 'fluxcore_ui',
  'fluxcore_admin', 'fluxcore_phone', 'fluxcore_identity',
];

function healthSnapshot() {
  const resources = Object.fromEntries(
    healthResources.map((name) => [name, GetResourceState(name)]),
  );
  let voice = null;
  if (resources.fluxcore_voice === 'started') {
    try {
      voice = globalThis.exports.fluxcore_voice.GetVoiceState();
    } catch (error) {
      voice = { available: false, error: String(error?.message || error) };
    }
  }
  return {
    ok: Object.values(resources).every((state) => state === 'started'),
    onlineCharacters: core.getPlayers().length,
    resources,
    voice,
  };
}

globalThis.exports('GetHealth', healthSnapshot);

RegisterCommand('fluxhealth', (source) => {
  const playerSource = Number(source);
  if (
    playerSource > 0
    && !IsPlayerAceAllowed(String(playerSource), 'fluxcore.admin')
    && !IsPlayerAceAllowed(String(playerSource), 'fluxcore.health')
  ) {
    return;
  }
  const snapshot = healthSnapshot();
  const unhealthy = Object.entries(snapshot.resources)
    .filter(([, state]) => state !== 'started')
    .map(([name, state]) => `${name}=${state}`);
  const voiceReady = snapshot.voice?.available === true ? 'ready' : 'unavailable';
  const summary = `Fluxcore health: ${snapshot.ok ? 'OK' : 'DEGRADED'} | online=${snapshot.onlineCharacters} | voice=${voiceReady}${unhealthy.length ? ` | ${unhealthy.join(', ')}` : ''}`;
  if (playerSource > 0) {
    runtime.emitClient(playerSource, 'chat:addMessage', {
      color: snapshot.ok ? [90, 200, 120] : [230, 170, 70],
      args: ['Fluxcore', summary],
    });
  }
  runtime.log(snapshot.ok ? 'info' : 'warn', summary);
}, false);

const saveTimer = setInterval(() => {
  try {
    const saved = core.saveAll();
    if (saved > 0) {
      runtime.log('info', `autosaved ${saved} active character(s)`);
    }
  } catch (error) {
    runtime.log('error', error?.stack || String(error));
  }
}, config.saveIntervalMs);

on('onResourceStop', (stoppedResource) => {
  if (stoppedResource !== resourceName) {
    return;
  }
  clearInterval(saveTimer);
  try {
    core.saveAll();
  } finally {
    database.close();
  }
});

runtime.log(
  'info',
  `started with SQLite at ${config.databaseFile}, locale ${locale.locale}, and ${config.maxCharacters} character slots`,
);
