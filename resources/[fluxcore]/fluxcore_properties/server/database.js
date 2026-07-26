'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { propertiesError } = require('./errors');

function nowIso() {
  return new Date().toISOString();
}

function property(row, keys = []) {
  return row
    ? {
        id: row.property_id,
        label: row.label,
        ownerCharacterId: row.owner_character_id,
        locked: Boolean(row.locked),
        purchasedAt: row.purchased_at,
        keys,
      }
    : null;
}

function key(row) {
  return {
    characterId: row.character_id,
    grantedByCharacterId: row.granted_by_character_id,
    grantedAt: row.granted_at,
  };
}

class PropertiesDatabase {
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
      throw propertiesError(
        'DATABASE_NEWER',
        `database schema ${version} is newer than this resource supports`,
      );
    }
    if (version === 0) {
      this.database.exec(`
        BEGIN IMMEDIATE;

        CREATE TABLE properties (
          property_id TEXT PRIMARY KEY,
          label TEXT NOT NULL,
          owner_character_id TEXT,
          locked INTEGER NOT NULL DEFAULT 1 CHECK (locked IN (0, 1)),
          purchased_at TEXT,
          reservation_token TEXT,
          reserved_at TEXT
        ) STRICT, WITHOUT ROWID;

        CREATE TABLE property_keys (
          property_id TEXT NOT NULL,
          character_id TEXT NOT NULL,
          granted_by_character_id TEXT NOT NULL,
          granted_at TEXT NOT NULL,
          PRIMARY KEY (property_id, character_id),
          FOREIGN KEY (property_id) REFERENCES properties(property_id)
            ON DELETE CASCADE
        ) STRICT, WITHOUT ROWID;

        CREATE TABLE property_ledger (
          id INTEGER PRIMARY KEY,
          property_id TEXT NOT NULL,
          action TEXT NOT NULL,
          character_id TEXT,
          amount INTEGER NOT NULL,
          reference TEXT NOT NULL,
          created_at TEXT NOT NULL
        ) STRICT;

        CREATE INDEX properties_owner_idx
          ON properties(owner_character_id);
        CREATE INDEX property_keys_character_idx
          ON property_keys(character_id);

        PRAGMA user_version = 1;
        COMMIT;
      `);
    }
  }

  prepare() {
    this.statements = {
      upsertDefinition: this.database.prepare(`
        INSERT INTO properties (property_id, label)
        VALUES (?, ?)
        ON CONFLICT(property_id) DO UPDATE SET label = excluded.label
      `),
      get: this.database.prepare(
        'SELECT * FROM properties WHERE property_id = ?',
      ),
      list: this.database.prepare('SELECT * FROM properties ORDER BY label'),
      keys: this.database.prepare(`
        SELECT * FROM property_keys
        WHERE property_id = ?
        ORDER BY granted_at
      `),
      owned: this.database.prepare(`
        SELECT * FROM properties
        WHERE owner_character_id = ?
        ORDER BY label
      `),
      accessible: this.database.prepare(`
        SELECT DISTINCT property.*
        FROM properties AS property
        LEFT JOIN property_keys AS property_key
          ON property_key.property_id = property.property_id
        WHERE property.owner_character_id = ?
           OR property_key.character_id = ?
        ORDER BY property.label
      `),
      reserve: this.database.prepare(`
        UPDATE properties
        SET reservation_token = ?, reserved_at = ?
        WHERE property_id = ?
          AND owner_character_id IS NULL
          AND reservation_token IS NULL
      `),
      release: this.database.prepare(`
        UPDATE properties
        SET reservation_token = NULL, reserved_at = NULL
        WHERE property_id = ? AND reservation_token = ?
      `),
      finalize: this.database.prepare(`
        UPDATE properties
        SET owner_character_id = ?, locked = 1, purchased_at = ?,
            reservation_token = NULL, reserved_at = NULL
        WHERE property_id = ?
          AND owner_character_id IS NULL
          AND reservation_token = ?
        RETURNING *
      `),
      clearStaleReservations: this.database.prepare(`
        UPDATE properties
        SET reservation_token = NULL, reserved_at = NULL
        WHERE owner_character_id IS NULL
          AND reservation_token IS NOT NULL
          AND reserved_at < ?
      `),
      addKey: this.database.prepare(`
        INSERT INTO property_keys (
          property_id, character_id, granted_by_character_id, granted_at
        ) VALUES (?, ?, ?, ?)
        ON CONFLICT(property_id, character_id) DO UPDATE SET
          granted_by_character_id = excluded.granted_by_character_id,
          granted_at = excluded.granted_at
      `),
      removeKey: this.database.prepare(`
        DELETE FROM property_keys
        WHERE property_id = ? AND character_id = ?
      `),
      hasKey: this.database.prepare(`
        SELECT 1 AS present FROM property_keys
        WHERE property_id = ? AND character_id = ?
      `),
      setLocked: this.database.prepare(`
        UPDATE properties SET locked = ?
        WHERE property_id = ? AND owner_character_id IS NOT NULL
        RETURNING *
      `),
      ledger: this.database.prepare(`
        INSERT INTO property_ledger (
          property_id, action, character_id, amount, reference, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `),
      deleteKeys: this.database.prepare(`
        DELETE FROM property_keys WHERE character_id = ?
      `),
      releaseOwned: this.database.prepare(`
        UPDATE properties
        SET owner_character_id = NULL, locked = 1, purchased_at = NULL
        WHERE owner_character_id = ?
      `),
    };
  }

  syncDefinitions(definitions) {
    for (const definition of Object.values(definitions)) {
      this.statements.upsertDefinition.run(definition.id, definition.label);
    }
  }

  get(id) {
    const row = this.statements.get.get(id);
    return property(
      row,
      row ? this.statements.keys.all(id).map(key) : [],
    );
  }

  list() {
    return this.statements.list
      .all()
      .map((row) => property(row, this.statements.keys.all(row.property_id).map(key)));
  }

  owned(characterId) {
    return this.statements.owned
      .all(characterId)
      .map((row) => property(row, this.statements.keys.all(row.property_id).map(key)));
  }

  accessible(characterId) {
    return this.statements.accessible
      .all(characterId, characterId)
      .map((row) => property(row, this.statements.keys.all(row.property_id).map(key)));
  }

  reserve(id, token) {
    return Number(this.statements.reserve.run(token, nowIso(), id).changes) === 1;
  }

  release(id, token) {
    return Number(this.statements.release.run(id, token).changes) === 1;
  }

  finalize(id, token, owner, amount, reference) {
    const row = this.statements.finalize.get(owner, nowIso(), id, token);
    if (!row) return null;
    this.statements.ledger.run(
      id,
      'purchase',
      owner,
      amount,
      reference,
      nowIso(),
    );
    return this.get(id);
  }

  clearStaleReservations(cutoffIso) {
    return Number(this.statements.clearStaleReservations.run(cutoffIso).changes);
  }

  addKey(id, characterId, grantedBy) {
    this.statements.addKey.run(id, characterId, grantedBy, nowIso());
    return this.get(id);
  }

  removeKey(id, characterId) {
    const removed = Number(this.statements.removeKey.run(id, characterId).changes);
    return { removed: removed === 1, property: this.get(id) };
  }

  hasAccess(id, characterId) {
    const current = this.get(id);
    return Boolean(
      current &&
        (current.ownerCharacterId === characterId ||
          this.statements.hasKey.get(id, characterId)),
    );
  }

  setLocked(id, locked) {
    const row = this.statements.setLocked.get(locked ? 1 : 0, id);
    return row ? this.get(id) : null;
  }

  deleteCharacter(characterId) {
    return {
      keys: Number(this.statements.deleteKeys.run(characterId).changes),
      properties: Number(this.statements.releaseOwned.run(characterId).changes),
    };
  }

  close() {
    this.database.close();
  }
}

module.exports = {
  PropertiesDatabase,
};
