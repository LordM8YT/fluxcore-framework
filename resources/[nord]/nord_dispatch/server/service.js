'use strict';

const { dispatchError } = require('./errors');

const CALL_ID_PATTERN = /^dsp_[a-f0-9]{16}$/u;
const CHARACTER_ID_PATTERN = /^vrd_[a-f0-9]{16}$/u;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function cleanText(value, minimum, maximum, label) {
  const text = String(value || '').trim().replace(/\s+/gu, ' ');
  if (text.length < minimum || text.length > maximum) {
    throw dispatchError(
      'VALIDATION_ERROR',
      `${label} must contain between ${minimum} and ${maximum} characters`,
    );
  }
  return text;
}

function callId(value) {
  const id = String(value || '').trim();
  if (!CALL_ID_PATTERN.test(id)) {
    throw dispatchError('VALIDATION_ERROR', 'dispatch call id is invalid');
  }
  return id;
}

function position(value) {
  const output = {
    x: Number(value?.x),
    y: Number(value?.y),
    z: Number(value?.z),
  };
  if (Object.values(output).some((coordinate) => !Number.isFinite(coordinate))) {
    throw dispatchError('POSITION_UNAVAILABLE', 'player position is unavailable');
  }
  return output;
}

class DispatchService {
  constructor(database, config, integrations, runtime) {
    this.database = database;
    this.config = config;
    this.integrations = integrations;
    this.runtime = runtime;
  }

  resolveOnline(identifier) {
    const player = this.integrations.core.getPlayerData(identifier);
    if (!player?.characterId) {
      throw dispatchError('PLAYER_NOT_FOUND', 'online player was not found');
    }
    const source = Number(
      typeof identifier === 'number' || /^\d+$/u.test(String(identifier))
        ? identifier
        : this.integrations.core.getPlayerSource(player.characterId),
    );
    if (!Number.isSafeInteger(source) || source <= 0) {
      throw dispatchError('PLAYER_NOT_FOUND', 'online player source was not found');
    }
    return { source, characterId: player.characterId, player };
  }

  definition(name) {
    const id = String(name || '').trim().toLowerCase();
    const definition = this.config.services[id];
    if (!definition) {
      throw dispatchError('SERVICE_NOT_FOUND', 'dispatch service is not configured');
    }
    return { id, definition };
  }

  requireStaff(identifier, serviceName) {
    const online = this.resolveOnline(identifier);
    const service = this.definition(serviceName);
    if (
      online.player.job?.onDuty !== true ||
      !service.definition.jobNames.includes(online.player.job?.name) ||
      !this.integrations.jobs.hasPermission(
        online.source,
        service.definition.permission,
        { requireDuty: true },
      )
    ) {
      throw dispatchError(
        'FORBIDDEN',
        `on-duty permission ${service.definition.permission} is required`,
      );
    }
    return { online, service };
  }

  create(identifier, serviceName, description, coordinates, options = {}) {
    const caller = this.resolveOnline(identifier);
    const service = this.definition(serviceName);
    const priority =
      options.priority === undefined
        ? service.definition.defaultPriority
        : Number(options.priority);
    if (!Number.isSafeInteger(priority) || priority < 1 || priority > 3) {
      throw dispatchError('VALIDATION_ERROR', 'priority must be between 1 and 3');
    }
    const call = this.database.create(
      service.id,
      caller.characterId,
      cleanText(options.title || service.definition.label, 1, 80, 'title'),
      cleanText(
        description,
        this.config.minimumDescriptionLength,
        512,
        'description',
      ),
      priority,
      position(coordinates),
    );
    this.publishService(service.id);
    return call;
  }

  get(identifier, id) {
    const call = this.database.get(callId(id));
    if (!call) {
      throw dispatchError('CALL_NOT_FOUND', 'dispatch call was not found');
    }
    this.requireStaff(identifier, call.service);
    return call;
  }

  snapshot(identifier) {
    const online = this.resolveOnline(identifier);
    const services = [];
    const calls = [];
    for (const [name, definition] of Object.entries(this.config.services)) {
      if (
        online.player.job?.onDuty === true &&
        definition.jobNames.includes(online.player.job?.name) &&
        this.integrations.jobs.hasPermission(
          online.source,
          definition.permission,
          { requireDuty: true },
        )
      ) {
        services.push(name);
        calls.push(...this.database.active(name, this.config.historyLimit));
      }
    }
    return {
      contract: 'varde.dispatch.bootstrap.v1',
      services,
      calls,
      roster: this.integrations.services.getRoster(),
    };
  }

  publish(identifier) {
    const online = this.resolveOnline(identifier);
    const snapshot = this.snapshot(online.source);
    this.runtime.emitClient(
      online.source,
      'varde_dispatch:client:update',
      clone(snapshot),
    );
    return snapshot;
  }

  publishService(serviceName) {
    const service = this.definition(serviceName);
    for (const player of this.integrations.core.getPlayers()) {
      if (
        player.job?.onDuty === true &&
        service.definition.jobNames.includes(player.job?.name)
      ) {
        try {
          this.publish(Number(player.source));
        } catch (error) {
          if (error?.code !== 'FORBIDDEN') {
            this.runtime.log('warn', error?.message || String(error));
          }
        }
      }
    }
  }

  assign(identifier, id) {
    const call = this.database.get(callId(id));
    if (!call) {
      throw dispatchError('CALL_NOT_FOUND', 'dispatch call was not found');
    }
    const staff = this.requireStaff(identifier, call.service);
    if (call.status === 'closed') {
      throw dispatchError('CALL_CLOSED', 'dispatch call is already closed');
    }
    const result = this.database.assign(call.id, staff.online.characterId);
    this.publishService(call.service);
    return result.call;
  }

  unassign(identifier, id) {
    const call = this.database.get(callId(id));
    if (!call) {
      throw dispatchError('CALL_NOT_FOUND', 'dispatch call was not found');
    }
    const staff = this.requireStaff(identifier, call.service);
    if (call.status === 'closed') {
      throw dispatchError('CALL_CLOSED', 'dispatch call is already closed');
    }
    const result = this.database.unassign(
      call.id,
      staff.online.characterId,
    );
    this.publishService(call.service);
    return result.call;
  }

  closeCall(identifier, id) {
    const call = this.database.get(callId(id));
    if (!call) {
      throw dispatchError('CALL_NOT_FOUND', 'dispatch call was not found');
    }
    this.requireStaff(identifier, call.service);
    const closed = this.database.closeCall(call.id);
    if (!closed) {
      throw dispatchError('CALL_CLOSED', 'dispatch call is already closed');
    }
    this.publishService(call.service);
    return closed;
  }

  deleteCharacter(characterId) {
    return CHARACTER_ID_PATTERN.test(String(characterId))
      ? this.database.deleteCharacter(String(characterId))
      : { units: 0, calls: 0 };
  }
}

module.exports = {
  DispatchService,
  callId,
  cleanText,
  position,
};
