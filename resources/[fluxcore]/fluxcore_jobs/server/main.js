'use strict';

const { JobsDatabase } = require('./database');
const { JobsError } = require('./errors');
const { loadConfig } = require('./config');
const { JobsService } = require('./service');

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
    const output = `[fluxcore_jobs] [${level}] ${message}`;
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
  setJob(identifier, job) {
    return globalThis.exports.fluxcore_core.SetJob(identifier, job);
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
const database = new JobsDatabase(config.databaseFile);
const jobs = new JobsService(database, config, core, runtime);
const requestTimes = new Map();

function rateLimit(source, key, minimumIntervalMs) {
  const id = `${source}:${key}`;
  const now = Date.now();
  const previous = requestTimes.get(id) || 0;
  if (now - previous < minimumIntervalMs) {
    return false;
  }
  requestTimes.set(id, now);
  return true;
}

function result(work) {
  try {
    return { ok: true, data: work() };
  } catch (error) {
    if (error instanceof JobsError) {
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
        message: 'the jobs resource could not complete the operation',
      },
    };
  }
}

function translate(key, replacements, fallback) {
  try {
    const handler = globalThis.exports.fluxcore_core.Locale;
    if (typeof handler === 'function') {
      return handler(key, replacements, fallback);
    }
  } catch {
    // Older core during a rolling restart: keep the English fallback.
  }
  return fallback;
}

function notify(source, message, kind = 'info', code = null) {
  if (Number(source) > 0) {
    runtime.emitClient(
      Number(source),
      'fluxcore_jobs:client:message',
      String(message),
      kind,
      code,
    );
  } else {
    runtime.log(kind === 'error' ? 'error' : 'info', String(message));
  }
}

function handle(source, work) {
  const response = result(work);
  if (!response.ok) {
    notify(source, response.error.message, 'error', response.error.code);
  }
  return response;
}

function actorForCommand(source) {
  return Number(source) === 0 ? 'console' : `source:${Number(source)}`;
}

function mayManage(source) {
  return Number(source) === 0 || IsPlayerAceAllowed(String(source), 'Fluxcore.jobs.manage');
}

on('Fluxcore:server:playerLoaded', (source) => {
  handle(source, () => jobs.sync(Number(source)));
});

on('Fluxcore:server:playerLoggedOut', (_source, characterId) => {
  handle(0, () => jobs.clearDuty(characterId, 'logout'));
});

on('Fluxcore:server:playerDropped', (_source, characterId) => {
  handle(0, () => jobs.clearDuty(characterId, 'disconnect'));
});

on('Fluxcore:server:characterDeleted', (_source, characterId) => {
  handle(0, () => jobs.deleteCharacter(characterId));
});

onNet('fluxcore_jobs:server:request', () => {
  const source = Number(global.source);
  if (rateLimit(source, 'request', 500)) {
    handle(source, () => jobs.sync(source));
  }
});

onNet('fluxcore_jobs:server:setActive', (jobName) => {
  const source = Number(global.source);
  if (rateLimit(source, 'active', 1000)) {
    handle(source, () => jobs.setActive(source, jobName));
  }
});

onNet('fluxcore_jobs:server:clock', (jobName) => {
  const source = Number(global.source);
  if (rateLimit(source, 'duty', 1000)) {
    handle(source, () => {
      const ped = GetPlayerPed(String(source));
      const raw = ped ? GetEntityCoords(ped) : null;
      const coordinates = raw
        ? {
            x: Number(raw[0] ?? raw.x),
            y: Number(raw[1] ?? raw.y),
            z: Number(raw[2] ?? raw.z),
          }
        : null;
      return jobs.clockAtDutyPoint(
        source,
        jobName,
        coordinates,
        `source:${source}`,
      );
    });
  }
});

RegisterCommand(
  'assignjob',
  (source, args) => {
    if (!mayManage(source)) {
      notify(
        source,
        translate(
          'jobs.permissionDenied',
          null,
          'You do not have permission to manage jobs.',
        ),
        'error',
      );
      return;
    }
    const target = Number(args[0]);
    const jobName = args[1];
    const grade = args[2] ?? 0;
    const response = handle(source, () =>
      jobs.assign(target, jobName, grade, actorForCommand(source)),
    );
    if (response.ok) {
      notify(
        source,
        translate(
          'jobs.assigned',
          { job: jobName, grade, source: target },
          `Assigned ${jobName} grade ${grade} to source ${target}.`,
        ),
      );
    }
  },
  false,
);

RegisterCommand(
  'removejob',
  (source, args) => {
    if (!mayManage(source)) {
      notify(
        source,
        translate(
          'jobs.permissionDenied',
          null,
          'You do not have permission to manage jobs.',
        ),
        'error',
      );
      return;
    }
    const target = Number(args[0]);
    const jobName = args[1];
    const response = handle(source, () =>
      jobs.remove(target, jobName, actorForCommand(source)),
    );
    if (response.ok) {
      notify(
        source,
        translate(
          'jobs.removed',
          { job: jobName, source: target },
          `Removed ${jobName} from source ${target}.`,
        ),
      );
    }
  },
  false,
);

globalThis.exports('GetJobs', (identifier) => {
  try {
    return jobs.getJobs(identifier);
  } catch {
    return [];
  }
});
globalThis.exports('HasJob', (identifier, jobName, minimumGrade) =>
  jobs.hasJob(identifier, jobName, minimumGrade),
);
globalThis.exports('HasPermission', (identifier, permission, options) =>
  jobs.hasPermission(identifier, permission, options),
);
globalThis.exports('AssignJob', (identifier, jobName, grade) =>
  result(() =>
    jobs.assign(
      identifier,
      jobName,
      grade,
      GetInvokingResource() || 'resource',
    ),
  ),
);
globalThis.exports('RemoveJob', (identifier, jobName) =>
  result(() =>
    jobs.remove(identifier, jobName, GetInvokingResource() || 'resource'),
  ),
);
globalThis.exports('SetActiveJob', (identifier, jobName) =>
  result(() =>
    jobs.setActive(identifier, jobName, GetInvokingResource() || 'resource'),
  ),
);
globalThis.exports('SetDuty', (identifier, onDuty) =>
  result(() =>
    jobs.setDuty(identifier, onDuty === true, GetInvokingResource() || 'resource'),
  ),
);

let nextPaydayAt = Date.now() + config.payIntervalMs;

function runPayday() {
  const reference = `jobs:payday:${Date.now()}`;
  let paid = 0;
  for (const player of core.getPlayers()) {
    const source = Number(player.source);
    try {
      const active = jobs.snapshot(source).activeJob;
      if (!active || !active.onDuty || active.payment <= 0) {
        continue;
      }
      const response = core.addMoney(
        source,
        config.payCurrency,
        active.payment,
        'job_payday',
        `${reference}:${player.characterId}:${active.name}:${active.grade}`,
      );
      if (response?.ok === false) {
        throw new Error(response.error?.message || 'core rejected payday');
      }
      paid += 1;
      notify(
        source,
        `Payday: ${active.payment} added to ${config.payCurrency}.`,
      );
    } catch (error) {
      runtime.log(
        'warn',
        `payday skipped source ${source}: ${error?.message || String(error)}`,
      );
    }
  }
  runtime.log('info', `payday completed for ${paid} on-duty players`);
  nextPaydayAt = Date.now() + config.payIntervalMs;
  return paid;
}

const paydayTimer = setInterval(runPayday, config.payIntervalMs);

RegisterCommand('paycheck', (source) => {
  const playerSource = Number(source);
  if (playerSource <= 0) {
    runtime.log('info', `next payday in ${Math.max(0, nextPaydayAt - Date.now())} ms`);
    return;
  }
  handle(playerSource, () => {
    const active = jobs.snapshot(playerSource).activeJob;
    const seconds = Math.ceil(
      Math.max(0, nextPaydayAt - Date.now()) / 1000,
    );
    notify(
      playerSource,
      active && active.onDuty && active.payment > 0
        ? `Next payday: ${active.payment} ${config.payCurrency} in ${seconds}s.`
        : `No paid on-duty job. Next payday check in ${seconds}s.`,
    );
    return true;
  });
}, false);

setTimeout(() => {
  for (const player of core.getPlayers()) {
    const numericSource = Number(player.source);
    if (core.getPlayerData(numericSource)) {
      handle(numericSource, () => jobs.sync(numericSource));
    }
  }
}, 0);

on('playerDropped', () => {
  const source = Number(global.source);
  for (const key of requestTimes.keys()) {
    if (key.startsWith(`${source}:`)) {
      requestTimes.delete(key);
    }
  }
});

on('onResourceStop', (stoppedResource) => {
  if (stoppedResource === resourceName) {
    clearInterval(paydayTimer);
    database.close();
  }
});

runtime.log(
  'info',
  `started with ${Object.keys(config.jobs).length} configured jobs`,
);
