'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { worldError } = require('./errors');

function nowIso() {
  return new Date().toISOString();
}

function door(row) {
  return row
    ? {
        id: row.door_id,
        label: row.label,
        locked: Boolean(row.locked),
        updatedByCharacterId: row.updated_by_character_id,
        updatedAt: row.updated_at,
      }
    : null;
}

class WorldDatabase {
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
      throw worldError(
        'DATABASE_NEWER',
        `database schema ${version} is newer than this resource supports`,
      );
    }
    if (version === 0) {
      this.database.exec(`
        BEGIN IMMEDIATE;

        CREATE TABLE world_doors (
          door_id TEXT PRIMARY KEY,
          label TEXT NOT NULL,
          locked INTEGER NOT NULL CHECK (locked IN (0, 1)),
          updated_by_character_id TEXT,
          updated_at TEXT NOT NULL
        ) STRICT, WITHOUT ROWID;

        CREATE TABLE world_purchases (
          id INTEGER PRIMARY KEY,
          category TEXT NOT NULL CHECK (category IN ('item', 'vehicle')),
          location_id TEXT NOT NULL,
          character_id TEXT NOT NULL,
          product_id TEXT NOT NULL,
          quantity INTEGER NOT NULL CHECK (quantity > 0),
          amount INTEGER NOT NULL CHECK (amount >= 0),
          reference TEXT NOT NULL UNIQUE,
          created_at TEXT NOT NULL
        ) STRICT;

        CREATE INDEX world_purchases_character_idx
          ON world_purchases(character_id, id DESC);

        PRAGMA user_version = 1;
        COMMIT;
      `);
    }
  }

  prepare() {
    this.statements = {
      upsertDoor: this.database.prepare(`
        INSERT INTO world_doors (door_id, label, locked, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(door_id) DO UPDATE SET label = excluded.label
      `),
      door: this.database.prepare(
        'SELECT * FROM world_doors WHERE door_id = ?',
      ),
      doors: this.database.prepare('SELECT * FROM world_doors ORDER BY door_id'),
      setDoor: this.database.prepare(`
        UPDATE world_doors
        SET locked = ?, updated_by_character_id = ?, updated_at = ?
        WHERE door_id = ?
        RETURNING *
      `),
      purchase: this.database.prepare(`
        INSERT INTO world_purchases (
          category, location_id, character_id, product_id,
          quantity, amount, reference, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `),
      purchases: this.database.prepare(`
        SELECT * FROM world_purchases
        WHERE character_id = ?
        ORDER BY id DESC
        LIMIT ?
      `),
    };
  }

  syncDoors(definitions) {
    for (const definition of Object.values(definitions)) {
      this.statements.upsertDoor.run(
        definition.id,
        definition.label,
        definition.defaultLocked ? 1 : 0,
        nowIso(),
      );
    }
  }

  getDoor(id) {
    return door(this.statements.door.get(id));
  }

  getDoors() {
    return this.statements.doors.all().map(door);
  }

  setDoor(id, locked, characterId) {
    return door(
      this.statements.setDoor.get(
        locked ? 1 : 0,
        characterId,
        nowIso(),
        id,
      ),
    );
  }

  recordPurchase(
    category,
    locationId,
    characterId,
    productId,
    quantity,
    amount,
    reference,
  ) {
    this.statements.purchase.run(
      category,
      locationId,
      characterId,
      productId,
      quantity,
      amount,
      reference,
      nowIso(),
    );
    return true;
  }

  purchases(characterId, limit = 100) {
    return this.statements.purchases.all(characterId, limit).map((row) => ({
      category: row.category,
      locationId: row.location_id,
      characterId: row.character_id,
      productId: row.product_id,
      quantity: Number(row.quantity),
      amount: Number(row.amount),
      reference: row.reference,
      createdAt: row.created_at,
    }));
  }

  close() {
    this.database.close();
  }
}

module.exports = {
  WorldDatabase,
};
