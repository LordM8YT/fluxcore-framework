'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { dispatchError } = require('./errors');

function nowIso() {
  return new Date().toISOString();
}

function makeCallId() {
  return `dsp_${crypto.randomBytes(8).toString('hex')}`;
}

function hydrateUnit(row) {
  return {
    characterId: row.character_id,
    assignedAt: row.assigned_at,
  };
}

function hydrateCall(row, units = []) {
  return row
    ? {
        id: row.public_id,
        service: row.service_name,
        callerCharacterId: row.caller_character_id,
        title: row.title,
        description: row.description,
        priority: Number(row.priority),
        position: {
          x: Number(row.x),
          y: Number(row.y),
          z: Number(row.z),
        },
        status: row.status,
        createdAt: row.created_at,
        closedAt: row.closed_at,
        units,
      }
    : null;
}

class DispatchDatabase {
  constructor(filename) {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    this.database = new DatabaseSync(filename);
    this.database.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA busy_timeout = 5000;
    `);
    this.migrate();
    this.prepare();
  }

  migrate() {
    const version = Number(
      this.database.prepare('PRAGMA user_version').get().user_version,
    );
    if (version > 1) {
      throw dispatchError(
        'DATABASE_NEWER',
        `database schema ${version} is newer than this resource supports`,
      );
    }
    if (version === 0) {
      this.database.exec(`
        BEGIN IMMEDIATE;

        CREATE TABLE dispatch_calls (
          id INTEGER PRIMARY KEY,
          public_id TEXT NOT NULL UNIQUE,
          service_name TEXT NOT NULL,
          caller_character_id TEXT,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          priority INTEGER NOT NULL CHECK (priority BETWEEN 1 AND 3),
          x REAL NOT NULL,
          y REAL NOT NULL,
          z REAL NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('open', 'assigned', 'closed')),
          created_at TEXT NOT NULL,
          closed_at TEXT
        ) STRICT;

        CREATE TABLE dispatch_units (
          call_id TEXT NOT NULL,
          character_id TEXT NOT NULL,
          assigned_at TEXT NOT NULL,
          PRIMARY KEY (call_id, character_id),
          FOREIGN KEY (call_id) REFERENCES dispatch_calls(public_id)
            ON DELETE CASCADE
        ) STRICT, WITHOUT ROWID;

        CREATE INDEX dispatch_calls_service_status_idx
          ON dispatch_calls(service_name, status, id DESC);
        CREATE INDEX dispatch_units_character_idx
          ON dispatch_units(character_id, assigned_at DESC);

        PRAGMA user_version = 1;
        COMMIT;
      `);
    }
  }

  prepare() {
    this.statements = {
      insert: this.database.prepare(`
        INSERT INTO dispatch_calls (
          public_id, service_name, caller_character_id, title,
          description, priority, x, y, z, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)
      `),
      get: this.database.prepare(
        'SELECT * FROM dispatch_calls WHERE public_id = ?',
      ),
      units: this.database.prepare(`
        SELECT character_id, assigned_at
        FROM dispatch_units
        WHERE call_id = ?
        ORDER BY assigned_at ASC
      `),
      active: this.database.prepare(`
        SELECT * FROM dispatch_calls
        WHERE service_name = ? AND status != 'closed'
        ORDER BY priority ASC, id DESC
        LIMIT ?
      `),
      assign: this.database.prepare(`
        INSERT OR IGNORE INTO dispatch_units (
          call_id, character_id, assigned_at
        ) VALUES (?, ?, ?)
      `),
      markAssigned: this.database.prepare(`
        UPDATE dispatch_calls
        SET status = 'assigned'
        WHERE public_id = ? AND status = 'open'
      `),
      unassign: this.database.prepare(`
        DELETE FROM dispatch_units
        WHERE call_id = ? AND character_id = ?
      `),
      unitCount: this.database.prepare(`
        SELECT COUNT(*) AS count FROM dispatch_units WHERE call_id = ?
      `),
      markOpen: this.database.prepare(`
        UPDATE dispatch_calls
        SET status = 'open'
        WHERE public_id = ? AND status = 'assigned'
      `),
      close: this.database.prepare(`
        UPDATE dispatch_calls
        SET status = 'closed', closed_at = ?
        WHERE public_id = ? AND status != 'closed'
        RETURNING *
      `),
      deleteCharacterUnits: this.database.prepare(`
        DELETE FROM dispatch_units WHERE character_id = ?
      `),
      anonymizeCaller: this.database.prepare(`
        UPDATE dispatch_calls
        SET caller_character_id = NULL
        WHERE caller_character_id = ?
      `),
    };
  }

  create(service, caller, title, description, priority, position) {
    const id = makeCallId();
    this.statements.insert.run(
      id,
      service,
      caller || null,
      title,
      description,
      priority,
      position.x,
      position.y,
      position.z,
      nowIso(),
    );
    return this.get(id);
  }

  get(id) {
    const row = this.statements.get.get(id);
    return hydrateCall(
      row,
      row ? this.statements.units.all(id).map(hydrateUnit) : [],
    );
  }

  active(service, limit) {
    return this.statements.active
      .all(service, limit)
      .map((row) =>
        hydrateCall(row, this.statements.units.all(row.public_id).map(hydrateUnit)),
      );
  }

  assign(id, characterId) {
    const inserted = Number(
      this.statements.assign.run(id, characterId, nowIso()).changes,
    );
    if (inserted === 1) {
      this.statements.markAssigned.run(id);
    }
    return { inserted: inserted === 1, call: this.get(id) };
  }

  unassign(id, characterId) {
    const removed = Number(
      this.statements.unassign.run(id, characterId).changes,
    );
    if (Number(this.statements.unitCount.get(id).count) === 0) {
      this.statements.markOpen.run(id);
    }
    return { removed: removed === 1, call: this.get(id) };
  }

  closeCall(id) {
    const row = this.statements.close.get(nowIso(), id);
    return row ? this.get(id) : null;
  }

  deleteCharacter(characterId) {
    const units = Number(
      this.statements.deleteCharacterUnits.run(characterId).changes,
    );
    const calls = Number(
      this.statements.anonymizeCaller.run(characterId).changes,
    );
    return { units, calls };
  }

  close() {
    this.database.close();
  }
}

module.exports = {
  DispatchDatabase,
  makeCallId,
};
