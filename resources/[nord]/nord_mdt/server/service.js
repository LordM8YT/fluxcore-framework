'use strict';

const { mdtError } = require('./errors');

const CHARACTER_ID_PATTERN = /^vrd_[a-f0-9]{16}$/u;
const WARRANT_ID_PATTERN = /^war_[a-f0-9]{16}$/u;
const BOLO_ID_PATTERN = /^bol_[a-f0-9]{16}$/u;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function unwrap(response, fallback) {
  if (!response || response.ok !== true) {
    throw mdtError(
      response?.error?.code || 'INTEGRATION_ERROR',
      response?.error?.message || fallback,
    );
  }
  return response.data;
}

function cleanText(value, minimum, maximum, label) {
  const text = String(value || '').trim().replace(/\s+/gu, ' ');
  if (text.length < minimum || text.length > maximum) {
    throw mdtError(
      'VALIDATION_ERROR',
      `${label} must contain between ${minimum} and ${maximum} characters`,
    );
  }
  return text;
}

function characterId(value) {
  const id = String(value || '').trim();
  if (!CHARACTER_ID_PATTERN.test(id)) {
    throw mdtError('VALIDATION_ERROR', 'character id is invalid');
  }
  return id;
}

class MdtService {
  constructor(database, config, integrations, runtime) {
    this.database = database;
    this.config = config;
    this.integrations = integrations;
    this.runtime = runtime;
  }

  resolveOnline(identifier) {
    const player = this.integrations.core.getPlayerData(identifier);
    if (!player?.characterId) {
      throw mdtError('PLAYER_NOT_FOUND', 'online player was not found');
    }
    const source = Number(
      typeof identifier === 'number' || /^\d+$/u.test(String(identifier))
        ? identifier
        : this.integrations.core.getPlayerSource(player.characterId),
    );
    if (!Number.isSafeInteger(source) || source <= 0) {
      throw mdtError('PLAYER_NOT_FOUND', 'online player source was not found');
    }
    return { source, characterId: player.characterId, player };
  }

  requirePermission(identifier, permission) {
    const online = this.resolveOnline(identifier);
    if (
      online.player.job?.onDuty !== true ||
      !this.integrations.jobs.hasPermission(online.source, permission, {
        requireDuty: true,
      })
    ) {
      throw mdtError(
        'FORBIDDEN',
        `on-duty permission ${permission} is required`,
      );
    }
    return online;
  }

  resolveSubject(value) {
    const id = characterId(value);
    const character = unwrap(
      this.integrations.core.getCharacterData(id),
      'character was not found',
    );
    this.database.syncPerson(character);
    return character;
  }

  syncOnlinePeople() {
    for (const player of this.integrations.core.getPlayers()) {
      this.database.syncPerson(player);
    }
  }

  dashboard(identifier) {
    const online = this.requirePermission(identifier, this.config.readPermission);
    this.syncOnlinePeople();
    let dispatch = null;
    try {
      dispatch = unwrap(
        this.integrations.dispatch.getDispatch(online.source),
        'dispatch is unavailable',
      );
    } catch {
      dispatch = null;
    }
    return {
      contract: 'Nord.mdt.bootstrap.v1',
      warrants: this.database.activeWarrants(this.config.historyLimit),
      bolos: this.database.activeBolos(this.config.historyLimit),
      reports: this.database.recentReports(this.config.historyLimit),
      dispatch,
    };
  }

  search(identifier, value) {
    this.requirePermission(identifier, this.config.readPermission);
    this.syncOnlinePeople();
    const query = cleanText(value, 2, 64, 'search');
    return this.database.searchPeople(query, this.config.searchLimit);
  }

  profile(identifier, subjectId) {
    this.requirePermission(identifier, this.config.readPermission);
    const character = this.resolveSubject(subjectId);
    return {
      person: this.database.getPerson(character.characterId),
      job: clone(character.job),
      vehicles: clone(
        this.integrations.vehicles.getVehicles(character.characterId) || [],
      ),
      reports: this.database.reportsForSubject(
        character.characterId,
        this.config.historyLimit,
      ),
      warrants: this.database.warrantsForSubject(
        character.characterId,
        this.config.historyLimit,
      ),
    };
  }

  createReport(identifier, input) {
    const author = this.requirePermission(
      identifier,
      this.config.writePermission,
    );
    const subjects = Array.isArray(input?.subjects)
      ? [...new Set(input.subjects.map(characterId))]
      : [];
    if (subjects.length === 0 || subjects.length > 16) {
      throw mdtError(
        'VALIDATION_ERROR',
        'a report requires between 1 and 16 subjects',
      );
    }
    for (const subject of subjects) this.resolveSubject(subject);
    return this.database.createReport(
      author.characterId,
      cleanText(input?.title, 3, 100, 'title'),
      cleanText(input?.narrative, 10, 10_000, 'narrative'),
      subjects,
    );
  }

  createWarrant(identifier, subjectId, reason) {
    const author = this.requirePermission(
      identifier,
      this.config.writePermission,
    );
    const subject = this.resolveSubject(subjectId);
    return this.database.createWarrant(
      subject.characterId,
      cleanText(reason, 4, 1000, 'reason'),
      author.characterId,
    );
  }

  closeWarrant(identifier, id) {
    this.requirePermission(identifier, this.config.writePermission);
    const warrantId = String(id || '').trim();
    if (!WARRANT_ID_PATTERN.test(warrantId)) {
      throw mdtError('VALIDATION_ERROR', 'warrant id is invalid');
    }
    const closed = this.database.closeWarrant(warrantId);
    if (!closed) {
      throw mdtError('WARRANT_NOT_ACTIVE', 'warrant was not found or is closed');
    }
    return closed;
  }

  createBolo(identifier, type, value, reason) {
    const author = this.requirePermission(
      identifier,
      this.config.writePermission,
    );
    const boloType = String(type || '').trim().toLowerCase();
    if (boloType !== 'person' && boloType !== 'vehicle') {
      throw mdtError('VALIDATION_ERROR', 'BOLO type must be person or vehicle');
    }
    return this.database.createBolo(
      boloType,
      cleanText(value, 2, 100, 'BOLO value'),
      cleanText(reason, 4, 1000, 'reason'),
      author.characterId,
    );
  }

  closeBolo(identifier, id) {
    this.requirePermission(identifier, this.config.writePermission);
    const boloId = String(id || '').trim();
    if (!BOLO_ID_PATTERN.test(boloId)) {
      throw mdtError('VALIDATION_ERROR', 'BOLO id is invalid');
    }
    const closed = this.database.closeBolo(boloId);
    if (!closed) {
      throw mdtError('BOLO_NOT_ACTIVE', 'BOLO was not found or is closed');
    }
    return closed;
  }

  deleteCharacter(id) {
    return CHARACTER_ID_PATTERN.test(String(id))
      ? this.database.deleteCharacter(String(id))
      : 0;
  }
}

module.exports = {
  MdtService,
  characterId,
  cleanText,
};
