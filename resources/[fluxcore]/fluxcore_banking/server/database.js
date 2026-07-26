'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { bankingError } = require('./errors');

function nowIso() {
  return new Date().toISOString();
}

function hydrate(row) {
  return row
    ? {
        characterId: row.character_id,
        accountNumber: row.account_number,
        createdAt: row.created_at,
      }
    : null;
}

class BankingDatabase {
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
      throw bankingError(
        'DATABASE_NEWER',
        `database schema ${version} is newer than this resource supports`,
      );
    }
    if (version === 0) {
      this.database.exec(`
        BEGIN IMMEDIATE;

        CREATE TABLE bank_profiles (
          character_id TEXT PRIMARY KEY,
          account_number TEXT NOT NULL UNIQUE,
          created_at TEXT NOT NULL
        ) STRICT;

        CREATE INDEX bank_profiles_account_idx
          ON bank_profiles(account_number);

        PRAGMA user_version = 1;
        COMMIT;
      `);
    }
  }

  prepare() {
    this.statements = {
      byCharacter: this.database.prepare(`
        SELECT * FROM bank_profiles WHERE character_id = ?
      `),
      byAccount: this.database.prepare(`
        SELECT * FROM bank_profiles WHERE account_number = ?
      `),
      insert: this.database.prepare(`
        INSERT INTO bank_profiles (
          character_id,
          account_number,
          created_at
        ) VALUES (?, ?, ?)
      `),
      delete: this.database.prepare(`
        DELETE FROM bank_profiles WHERE character_id = ?
      `),
      count: this.database.prepare(`
        SELECT COUNT(*) AS count FROM bank_profiles
      `),
    };
  }

  makeAccountNumber(prefix, digits) {
    const maximum = 10 ** digits;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const suffix = crypto
        .randomInt(0, maximum)
        .toString()
        .padStart(digits, '0');
      const accountNumber = `${prefix}${suffix}`;
      if (!this.statements.byAccount.get(accountNumber)) {
        return accountNumber;
      }
    }
    throw bankingError(
      'ACCOUNT_NUMBER_EXHAUSTED',
      'a unique bank account number could not be generated',
    );
  }

  ensure(characterId, prefix, digits) {
    const existing = this.getByCharacter(characterId);
    if (existing) {
      return existing;
    }
    const accountNumber = this.makeAccountNumber(prefix, digits);
    this.statements.insert.run(characterId, accountNumber, nowIso());
    return this.getByCharacter(characterId);
  }

  getByCharacter(characterId) {
    return hydrate(this.statements.byCharacter.get(characterId));
  }

  getByAccount(accountNumber) {
    return hydrate(this.statements.byAccount.get(accountNumber));
  }

  deleteCharacter(characterId) {
    return Number(this.statements.delete.run(characterId).changes) === 1;
  }

  count() {
    return Number(this.statements.count.get().count);
  }

  close() {
    this.database.close();
  }
}

module.exports = {
  BankingDatabase,
};
