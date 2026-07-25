'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { servicesError } = require('./errors');

function nowIso() {
  return new Date().toISOString();
}

function makeInvoiceId() {
  return `inv_${crypto.randomBytes(8).toString('hex')}`;
}

function hydrate(row) {
  return row
    ? {
        id: row.public_id,
        service: row.service_name,
        issuerCharacterId: row.issuer_character_id,
        recipientCharacterId: row.recipient_character_id,
        businessId: row.business_id,
        amount: Number(row.amount),
        description: row.description,
        status: row.status,
        paymentReference: row.payment_reference,
        createdAt: row.created_at,
        paidAt: row.paid_at,
        cancelledAt: row.cancelled_at,
      }
    : null;
}

class ServicesDatabase {
  constructor(filename) {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    this.database = new DatabaseSync(filename);
    this.inTransaction = false;
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
      throw servicesError(
        'DATABASE_NEWER',
        `database schema ${version} is newer than this resource supports`,
      );
    }
    if (version === 0) {
      this.database.exec(`
        BEGIN IMMEDIATE;

        CREATE TABLE service_invoices (
          id INTEGER PRIMARY KEY,
          public_id TEXT NOT NULL UNIQUE,
          service_name TEXT NOT NULL,
          issuer_character_id TEXT NOT NULL,
          recipient_character_id TEXT NOT NULL,
          business_id TEXT,
          amount INTEGER NOT NULL CHECK (amount > 0),
          description TEXT NOT NULL,
          status TEXT NOT NULL CHECK (
            status IN ('pending', 'processing', 'paid', 'cancelled')
          ),
          payment_reference TEXT,
          created_at TEXT NOT NULL,
          paid_at TEXT,
          cancelled_at TEXT
        ) STRICT;

        CREATE INDEX service_invoices_recipient_idx
          ON service_invoices(recipient_character_id, id DESC);
        CREATE INDEX service_invoices_issuer_idx
          ON service_invoices(issuer_character_id, id DESC);
        CREATE INDEX service_invoices_status_idx
          ON service_invoices(status, id DESC);

        PRAGMA user_version = 1;
        COMMIT;
      `);
    }
  }

  prepare() {
    this.statements = {
      insert: this.database.prepare(`
        INSERT INTO service_invoices (
          public_id, service_name, issuer_character_id,
          recipient_character_id, business_id, amount,
          description, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
      `),
      get: this.database.prepare(`
        SELECT * FROM service_invoices WHERE public_id = ?
      `),
      recipient: this.database.prepare(`
        SELECT * FROM service_invoices
        WHERE recipient_character_id = ?
        ORDER BY id DESC
        LIMIT ?
      `),
      issuer: this.database.prepare(`
        SELECT * FROM service_invoices
        WHERE issuer_character_id = ?
        ORDER BY id DESC
        LIMIT ?
      `),
      claim: this.database.prepare(`
        UPDATE service_invoices
        SET status = 'processing', payment_reference = ?
        WHERE public_id = ? AND status = 'pending'
        RETURNING *
      `),
      reset: this.database.prepare(`
        UPDATE service_invoices
        SET status = 'pending', payment_reference = NULL
        WHERE public_id = ? AND status = 'processing'
      `),
      paid: this.database.prepare(`
        UPDATE service_invoices
        SET status = 'paid', paid_at = ?
        WHERE public_id = ? AND status = 'processing'
        RETURNING *
      `),
      cancel: this.database.prepare(`
        UPDATE service_invoices
        SET status = 'cancelled', cancelled_at = ?
        WHERE public_id = ? AND status = 'pending'
        RETURNING *
      `),
      cancelCharacter: this.database.prepare(`
        UPDATE service_invoices
        SET status = 'cancelled', cancelled_at = ?
        WHERE status = 'pending'
          AND (
            issuer_character_id = ?
            OR recipient_character_id = ?
          )
      `),
    };
  }

  transaction(work) {
    if (this.inTransaction) {
      throw servicesError(
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

  create(service, issuer, recipient, businessId, amount, description) {
    const id = makeInvoiceId();
    this.statements.insert.run(
      id,
      service,
      issuer,
      recipient,
      businessId || null,
      amount,
      description,
      nowIso(),
    );
    return this.get(id);
  }

  get(id) {
    return hydrate(this.statements.get.get(id));
  }

  forRecipient(characterId, limit) {
    return this.statements.recipient.all(characterId, limit).map(hydrate);
  }

  forIssuer(characterId, limit) {
    return this.statements.issuer.all(characterId, limit).map(hydrate);
  }

  claim(id, reference) {
    return hydrate(this.statements.claim.get(reference, id));
  }

  reset(id) {
    return Number(this.statements.reset.run(id).changes) === 1;
  }

  markPaid(id) {
    return hydrate(this.statements.paid.get(nowIso(), id));
  }

  cancel(id) {
    return hydrate(this.statements.cancel.get(nowIso(), id));
  }

  deleteCharacter(characterId) {
    return Number(
      this.statements.cancelCharacter.run(
        nowIso(),
        characterId,
        characterId,
      ).changes,
    );
  }

  close() {
    this.database.close();
  }
}

module.exports = {
  ServicesDatabase,
  makeInvoiceId,
};
