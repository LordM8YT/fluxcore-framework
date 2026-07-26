'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { businessesError } = require('./errors');

function nowIso() {
  return new Date().toISOString();
}

function makeBusinessId() {
  return `biz_${crypto.randomBytes(8).toString('hex')}`;
}

function business(row) {
  return row
    ? {
        id: row.public_id,
        type: row.business_type,
        name: row.name,
        ownerCharacterId: row.owner_character_id,
        treasury: Number(row.treasury),
        active: row.is_enabled === 1,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    : null;
}

function member(row) {
  return row
    ? {
        businessId: row.business_public_id || row.business_id,
        characterId: row.character_id,
        role: row.role,
        active: row.is_active === 1,
        joinedAt: row.joined_at,
        updatedAt: row.updated_at,
      }
    : null;
}

class BusinessesDatabase {
  constructor(filename) {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    this.database = new DatabaseSync(filename);
    this.inTransaction = false;
    this.database.exec(`
      PRAGMA foreign_keys = ON;
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
      throw businessesError(
        'DATABASE_NEWER',
        `database schema ${version} is newer than this resource supports`,
      );
    }
    if (version === 0) {
      this.database.exec(`
        BEGIN IMMEDIATE;

        CREATE TABLE businesses (
          id INTEGER PRIMARY KEY,
          public_id TEXT NOT NULL UNIQUE,
          business_type TEXT NOT NULL,
          name TEXT NOT NULL COLLATE NOCASE UNIQUE,
          owner_character_id TEXT,
          treasury INTEGER NOT NULL DEFAULT 0 CHECK (treasury >= 0),
          is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        ) STRICT;

        CREATE TABLE business_members (
          business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
          character_id TEXT NOT NULL,
          role TEXT NOT NULL,
          is_active INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
          joined_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (business_id, character_id)
        ) STRICT;

        CREATE INDEX business_members_character_idx
          ON business_members(character_id);
        CREATE UNIQUE INDEX business_members_one_active_idx
          ON business_members(character_id)
          WHERE is_active = 1;

        CREATE TABLE business_ledger (
          id INTEGER PRIMARY KEY,
          business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
          delta INTEGER NOT NULL,
          balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
          reason TEXT NOT NULL,
          reference TEXT,
          actor TEXT NOT NULL,
          created_at TEXT NOT NULL
        ) STRICT;

        CREATE INDEX business_ledger_business_idx
          ON business_ledger(business_id, id DESC);

        CREATE TABLE business_audit (
          id INTEGER PRIMARY KEY,
          business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
          action TEXT NOT NULL,
          details_json TEXT NOT NULL,
          actor TEXT NOT NULL,
          created_at TEXT NOT NULL
        ) STRICT;

        CREATE INDEX business_audit_business_idx
          ON business_audit(business_id, id DESC);

        PRAGMA user_version = 1;
        COMMIT;
      `);
    }
  }

  prepare() {
    this.statements = {
      insertBusiness: this.database.prepare(`
        INSERT INTO businesses (
          public_id, business_type, name, owner_character_id,
          treasury, is_enabled, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 0, 1, ?, ?)
      `),
      getBusiness: this.database.prepare(`
        SELECT * FROM businesses WHERE public_id = ?
      `),
      listBusinesses: this.database.prepare(`
        SELECT * FROM businesses ORDER BY name ASC
      `),
      internalId: this.database.prepare(`
        SELECT id FROM businesses WHERE public_id = ?
      `),
      listForCharacter: this.database.prepare(`
        SELECT
          b.*,
          m.role,
          m.is_active,
          m.joined_at,
          m.updated_at AS member_updated_at
        FROM business_members m
        JOIN businesses b ON b.id = m.business_id
        WHERE m.character_id = ?
        ORDER BY m.is_active DESC, b.name ASC
      `),
      getMember: this.database.prepare(`
        SELECT
          m.*,
          b.public_id AS business_public_id
        FROM business_members m
        JOIN businesses b ON b.id = m.business_id
        WHERE b.public_id = ? AND m.character_id = ?
      `),
      listMembers: this.database.prepare(`
        SELECT
          m.*,
          b.public_id AS business_public_id
        FROM business_members m
        JOIN businesses b ON b.id = m.business_id
        WHERE b.public_id = ?
        ORDER BY m.joined_at ASC, m.character_id ASC
      `),
      countMemberships: this.database.prepare(`
        SELECT COUNT(*) AS count
        FROM business_members
        WHERE character_id = ?
      `),
      insertMember: this.database.prepare(`
        INSERT INTO business_members (
          business_id, character_id, role, is_active, joined_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(business_id, character_id) DO UPDATE SET
          role = excluded.role,
          updated_at = excluded.updated_at
      `),
      clearActive: this.database.prepare(`
        UPDATE business_members
        SET is_active = 0, updated_at = ?
        WHERE character_id = ? AND is_active = 1
      `),
      activate: this.database.prepare(`
        UPDATE business_members
        SET is_active = 1, updated_at = ?
        WHERE business_id = ? AND character_id = ?
      `),
      removeMember: this.database.prepare(`
        DELETE FROM business_members
        WHERE business_id = ? AND character_id = ?
      `),
      updateTreasury: this.database.prepare(`
        UPDATE businesses
        SET treasury = ?, updated_at = ?
        WHERE id = ?
      `),
      insertLedger: this.database.prepare(`
        INSERT INTO business_ledger (
          business_id, delta, balance_after, reason, reference, actor, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `),
      listLedger: this.database.prepare(`
        SELECT delta, balance_after, reason, reference, actor, created_at
        FROM business_ledger
        WHERE business_id = ?
        ORDER BY id DESC
        LIMIT ?
      `),
      insertAudit: this.database.prepare(`
        INSERT INTO business_audit (
          business_id, action, details_json, actor, created_at
        ) VALUES (?, ?, ?, ?, ?)
      `),
      listAudit: this.database.prepare(`
        SELECT action, details_json, actor, created_at
        FROM business_audit
        WHERE business_id = ?
        ORDER BY id DESC
        LIMIT ?
      `),
      disableOwned: this.database.prepare(`
        UPDATE businesses
        SET owner_character_id = NULL, is_enabled = 0, updated_at = ?
        WHERE owner_character_id = ?
      `),
      deleteMemberships: this.database.prepare(`
        DELETE FROM business_members WHERE character_id = ?
      `),
    };
  }

  transaction(work) {
    if (this.inTransaction) {
      throw businessesError(
        'DATABASE_TRANSACTION',
        'nested transactions are unsupported',
      );
    }
    this.inTransaction = true;
    let began = false;
    try {
      this.database.exec('BEGIN IMMEDIATE');
      began = true;
      const value = work();
      this.database.exec('COMMIT');
      return value;
    } catch (error) {
      if (began) {
        this.database.exec('ROLLBACK');
      }
      throw error;
    } finally {
      this.inTransaction = false;
    }
  }

  id(publicId) {
    const row = this.statements.internalId.get(publicId);
    if (!row) {
      throw businessesError('BUSINESS_NOT_FOUND', 'business was not found');
    }
    return Number(row.id);
  }

  audit(publicId, action, details, actor) {
    this.statements.insertAudit.run(
      publicId ? this.id(publicId) : null,
      action,
      JSON.stringify(details || {}),
      String(actor || 'system').slice(0, 96),
      nowIso(),
    );
  }

  create(type, name, ownerCharacterId, actor) {
    const timestamp = nowIso();
    const publicId = makeBusinessId();
    return this.transaction(() => {
      const result = this.statements.insertBusiness.run(
        publicId,
        type,
        name,
        ownerCharacterId,
        timestamp,
        timestamp,
      );
      const active = this.countMemberships(ownerCharacterId) === 0 ? 1 : 0;
      this.statements.insertMember.run(
        Number(result.lastInsertRowid),
        ownerCharacterId,
        'owner',
        active,
        timestamp,
        timestamp,
      );
      this.audit(publicId, 'created', { type, name, ownerCharacterId }, actor);
      return this.get(publicId);
    });
  }

  get(publicId) {
    return business(this.statements.getBusiness.get(publicId));
  }

  list() {
    return this.statements.listBusinesses.all().map(business);
  }

  listForCharacter(characterId) {
    return this.statements.listForCharacter.all(characterId).map((row) => ({
      business: business(row),
      membership: {
        businessId: row.public_id,
        characterId,
        role: row.role,
        active: row.is_active === 1,
        joinedAt: row.joined_at,
        updatedAt: row.member_updated_at,
      },
    }));
  }

  getMember(publicId, characterId) {
    return member(this.statements.getMember.get(publicId, characterId));
  }

  listMembers(publicId) {
    return this.statements.listMembers.all(publicId).map(member);
  }

  countMemberships(characterId) {
    return Number(
      this.statements.countMemberships.get(characterId).count,
    );
  }

  setMember(publicId, characterId, role, actor) {
    const timestamp = nowIso();
    const businessId = this.id(publicId);
    const existing = this.getMember(publicId, characterId);
    const makeActive =
      !existing && this.countMemberships(characterId) === 0 ? 1 : 0;
    this.transaction(() => {
      this.statements.insertMember.run(
        businessId,
        characterId,
        role,
        makeActive,
        timestamp,
        timestamp,
      );
      this.audit(
        publicId,
        existing ? 'member_role_changed' : 'member_added',
        { characterId, role },
        actor,
      );
    });
    return this.getMember(publicId, characterId);
  }

  setActive(publicId, characterId, actor) {
    const membership = this.getMember(publicId, characterId);
    if (!membership) {
      throw businessesError(
        'MEMBERSHIP_NOT_FOUND',
        'business membership was not found',
      );
    }
    const businessId = this.id(publicId);
    this.transaction(() => {
      const timestamp = nowIso();
      this.statements.clearActive.run(timestamp, characterId);
      this.statements.activate.run(timestamp, businessId, characterId);
      this.audit(publicId, 'activated', { characterId }, actor);
    });
    return this.getMember(publicId, characterId);
  }

  removeMember(publicId, characterId, actor) {
    const result = this.statements.removeMember.run(this.id(publicId), characterId);
    if (Number(result.changes) === 1) {
      this.audit(publicId, 'member_removed', { characterId }, actor);
      return true;
    }
    return false;
  }

  changeTreasury(publicId, delta, maximum, reason, reference, actor) {
    return this.transaction(() => {
      const current = this.get(publicId);
      if (!current) {
        throw businessesError('BUSINESS_NOT_FOUND', 'business was not found');
      }
      const balance = current.treasury + delta;
      if (balance < 0) {
        throw businessesError(
          'INSUFFICIENT_FUNDS',
          'business treasury has insufficient funds',
        );
      }
      if (!Number.isSafeInteger(balance) || balance > maximum) {
        throw businessesError(
          'BALANCE_LIMIT_EXCEEDED',
          'business treasury would exceed the configured limit',
        );
      }
      const businessId = this.id(publicId);
      this.statements.updateTreasury.run(balance, nowIso(), businessId);
      this.statements.insertLedger.run(
        businessId,
        delta,
        balance,
        reason,
        reference || null,
        String(actor || 'resource').slice(0, 96),
        nowIso(),
      );
      return balance;
    });
  }

  ledger(publicId, limit = 50) {
    return this.statements.listLedger.all(this.id(publicId), limit).map((row) => ({
      delta: Number(row.delta),
      balanceAfter: Number(row.balance_after),
      reason: row.reason,
      reference: row.reference,
      actor: row.actor,
      createdAt: row.created_at,
    }));
  }

  auditLog(publicId, limit = 50) {
    return this.statements.listAudit.all(this.id(publicId), limit).map((row) => ({
      action: row.action,
      details: JSON.parse(row.details_json),
      actor: row.actor,
      createdAt: row.created_at,
    }));
  }

  deleteCharacter(characterId) {
    return this.transaction(() => {
      const timestamp = nowIso();
      const disabled = Number(
        this.statements.disableOwned.run(timestamp, characterId).changes,
      );
      const memberships = Number(
        this.statements.deleteMemberships.run(characterId).changes,
      );
      return { disabled, memberships };
    });
  }

  close() {
    this.database.close();
  }
}

module.exports = {
  BusinessesDatabase,
  makeBusinessId,
};
