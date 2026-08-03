'use strict';

const { PhoneDatabase } = require('./database');
const { PhoneError, phoneError } = require('./errors');
const { loadConfig } = require('./config');
const { PhoneService } = require('./service');

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
    const output = `[fluxcore_phone] [${level}] ${message}`;
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

function requireResource(name) {
  if (GetResourceState(name) !== 'started') {
    throw phoneError(
      'INTEGRATION_UNAVAILABLE',
      `${name} must be started for this operation`,
    );
  }
}

const integrations = {
  core: {
    getPlayerData(identifier) {
      return globalThis.exports.fluxcore_core.GetPlayerData(identifier);
    },
    getPlayerSource(characterId) {
      return globalThis.exports.fluxcore_core.GetPlayerSource(characterId);
    },
  },
  inventory: {
    hasItem(identifier, itemName, amount) {
      requireResource('fluxcore_inventory');
      return globalThis.exports.fluxcore_inventory.HasItem(
        identifier,
        itemName,
        amount,
      );
    },
  },
  voice: {
    create(firstSource, secondSource) {
      requireResource('fluxcore_voice');
      return globalThis.exports.fluxcore_voice.CreatePrivateChannel(firstSource, secondSource);
    },
    destroy(channel) {
      if (GetResourceState('fluxcore_voice') === 'started') {
        globalThis.exports.fluxcore_voice.DeletePrivateChannel(channel);
      }
    },
    createRoom() { requireResource('fluxcore_voice'); return globalThis.exports.fluxcore_voice.CreateManagedVoiceChannel(); },
    joinRoom(channel, source) { return globalThis.exports.fluxcore_voice.JoinManagedVoiceChannel(channel, source); },
    leaveRoom(channel, source) { return globalThis.exports.fluxcore_voice.LeaveManagedVoiceChannel(channel, source); },
  },
};

const database = new PhoneDatabase(
  config.databaseFile,
  config.numberPrefix,
  config.numberLength,
);
const phone = new PhoneService(database, config, integrations, runtime);
const requestHistory = new Map();
const activeCalls = new Map();
let callSequence = 0;
const cipherVoiceRooms = new Map();
const cipherVoiceMembership = new Map();

function leaveCipherVoice(source) {
  const membership = cipherVoiceMembership.get(source);
  if (!membership) return false;
  integrations.voice.leaveRoom(membership.voiceChannel, source);
  membership.members.delete(source); cipherVoiceMembership.delete(source);
  runtime.emitClient(source, 'fluxcore_phone:client:cipherVoice', { channel: membership.channel, joined: false });
  return true;
}

function joinCipherVoice(source, payload) {
  const online = phone.resolveOnline(source);
  phone.ensureAccount(online.characterId); phone.database.ensureCipherProfile(online.characterId);
  const channel = phone.cipherChannel(payload?.channel);
  leaveCipherVoice(source);
  let room = cipherVoiceRooms.get(channel);
  if (!room) {
    const voiceChannel = Number(integrations.voice.createRoom());
    if (!Number.isSafeInteger(voiceChannel)) throw phoneError('VOICE_UNAVAILABLE', 'Cipher voice is unavailable');
    room = { channel, voiceChannel, members: new Set() }; cipherVoiceRooms.set(channel, room);
  }
  if (!integrations.voice.joinRoom(room.voiceChannel, source)) throw phoneError('VOICE_UNAVAILABLE', 'Cipher voice is unavailable');
  room.members.add(source); cipherVoiceMembership.set(source, room);
  runtime.emitClient(source, 'fluxcore_phone:client:cipherVoice', { channel, joined: true });
  return { channel, joined: true };
}

function publishCall(call, status, reason) {
  for (const participant of [call.caller, call.recipient]) {
    const peer = participant.source === call.caller.source ? call.recipient : call.caller;
    runtime.emitClient(participant.source, 'fluxcore_phone:client:callState', {
      id: call.id,
      status: status === 'ringing' ? (participant.source === call.recipient.source ? 'incoming' : 'outgoing') : status,
      phoneNumber: peer.phoneNumber,
      name: phone.contactName(participant.characterId, peer.phoneNumber),
      reason: reason || null,
    });
  }
}

function finishCall(call, reason = 'Call ended.') {
  if (!call || call.ended) return false;
  call.ended = true;
  if (call.channel !== null) integrations.voice.destroy(call.channel);
  activeCalls.delete(call.caller.source);
  activeCalls.delete(call.recipient.source);
  publishCall(call, 'ended', reason);
  return true;
}

function startCall(source, payload) {
  const callerOnline = phone.resolveOnline(source);
  const callerAccount = phone.ensureAccount(callerOnline.characterId);
  const recipientNumber = phone.phoneNumber(payload?.phoneNumber);
  const recipientAccount = database.getAccountByNumber(recipientNumber);
  if (!recipientAccount || recipientNumber === callerAccount.phoneNumber) throw phoneError('CALL_INVALID', 'that number cannot be called');
  const recipientSource = Number(integrations.core.getPlayerSource(recipientAccount.characterId));
  if (!Number.isSafeInteger(recipientSource) || recipientSource <= 0) throw phoneError('CALL_UNAVAILABLE', 'that phone is unavailable');
  if (activeCalls.has(source) || activeCalls.has(recipientSource)) throw phoneError('CALL_BUSY', 'the line is busy');
  const call = { id: `call:${Date.now()}:${++callSequence}`, caller: { source, characterId: callerOnline.characterId, phoneNumber: callerAccount.phoneNumber }, recipient: { source: recipientSource, characterId: recipientAccount.characterId, phoneNumber: recipientAccount.phoneNumber }, channel: null, ended: false };
  activeCalls.set(source, call); activeCalls.set(recipientSource, call); publishCall(call, 'ringing');
  setTimeout(() => { if (!call.ended && call.channel === null) finishCall(call, 'No answer.'); }, 30000);
  return { id: call.id };
}

function acceptCall(source) {
  const call = activeCalls.get(source);
  if (!call || call.recipient.source !== source || call.channel !== null) throw phoneError('CALL_NOT_FOUND', 'incoming call was not found');
  const channel = integrations.voice.create(call.caller.source, call.recipient.source);
  if (!Number.isSafeInteger(Number(channel))) { finishCall(call, 'Voice is unavailable.'); throw phoneError('CALL_UNAVAILABLE', 'voice is unavailable'); }
  call.channel = Number(channel); publishCall(call, 'connected'); return true;
}

const limits = {
  'messages:send': { limit: 5, windowMs: 10_000 },
  'messages:list': { limit: 20, windowMs: 10_000 },
  default: { limit: 12, windowMs: 10_000 },
};

function allowRequest(source, method) {
  const rule = limits[method] || limits.default;
  const key = `${source}:${method}`;
  const cutoff = Date.now() - rule.windowMs;
  const history = (requestHistory.get(key) || []).filter(
    (timestamp) => timestamp > cutoff,
  );
  if (history.length >= rule.limit) {
    requestHistory.set(key, history);
    return false;
  }
  history.push(Date.now());
  requestHistory.set(key, history);
  return true;
}

function result(work) {
  try {
    return { ok: true, data: work() };
  } catch (error) {
    if (error instanceof PhoneError) {
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
        message: 'the phone resource could not complete the operation',
      },
    };
  }
}

function handle(source, method, payload) {
  switch (method) {
    case 'bootstrap':
      return phone.bootstrap(source);
    case 'contacts:create':
      return phone.createContact(source, payload);
    case 'contacts:update':
      return phone.updateContact(source, payload);
    case 'contacts:delete':
      return phone.deleteContact(source, payload);
    case 'messages:list':
      return phone.listMessages(source, payload);
    case 'messages:send':
      return phone.send(source, payload);
    case 'calls:start':
      return startCall(source, payload);
    case 'calls:accept':
      return acceptCall(source);
    case 'calls:end':
      return finishCall(activeCalls.get(source), 'Call ended.');
    case 'cipher:bootstrap':
      return phone.cipherBootstrap(source);
    case 'cipher:messages':
      return phone.cipherMessages(source, payload);
    case 'cipher:send':
      return phone.cipherSend(source, payload);
    case 'cipher:voice:join':
      return joinCipherVoice(source, payload);
    case 'cipher:voice:leave':
      return leaveCipherVoice(source);
    default:
      throw phoneError('METHOD_NOT_FOUND', 'phone method was not found');
  }
}

onNet('fluxcore_phone:server:request', (requestId, method, payload) => {
  const source = Number(global.source);
  const name = String(method || '');
  let response;
  if (!allowRequest(source, name)) {
    response = {
      ok: false,
      error: { code: 'RATE_LIMITED', message: 'too many phone requests' },
    };
  } else {
    let size = Infinity;
    try {
      size = Buffer.byteLength(JSON.stringify(payload || {}), 'utf8');
    } catch {
      size = Infinity;
    }
    response =
      size <= 8192
        ? result(() => handle(source, name, payload || {}))
        : {
            ok: false,
            error: {
              code: 'PAYLOAD_TOO_LARGE',
              message: 'phone request payload is too large',
            },
          };
  }
  runtime.emitClient(
    source,
    'fluxcore_phone:client:response',
    String(requestId || '').slice(0, 96),
    response,
  );
});

on('Fluxcore:server:playerLoaded', (source, snapshot) => {
  try {
    phone.ensureAccount(snapshot.characterId);
  } catch (error) {
    runtime.log('error', error?.stack || String(error));
  }
});

on('Fluxcore:server:characterDeleted', (_source, characterId) => {
  try {
    phone.deleteCharacter(characterId);
  } catch (error) {
    runtime.log('error', error?.stack || String(error));
  }
});

on('playerDropped', () => {
  const source = Number(global.source);
  finishCall(activeCalls.get(source), 'Call disconnected.');
  leaveCipherVoice(source);
  for (const key of requestHistory.keys()) {
    if (key.startsWith(`${source}:`)) {
      requestHistory.delete(key);
    }
  }
});

globalThis.exports('GetPhoneNumber', (identifier) => {
  try {
    return phone.account(identifier).phoneNumber;
  } catch {
    return null;
  }
});
globalThis.exports('SendMessage', (fromIdentifier, toNumber, body) =>
  result(() => phone.sendTrusted(fromIdentifier, toNumber, body)),
);

on('onResourceStop', (stoppedResource) => {
  if (stoppedResource === resourceName) {
    database.close();
  }
});

runtime.log(
  'info',
  `started with text and voice calls using ${config.numberLength}-digit numbers`,
);
