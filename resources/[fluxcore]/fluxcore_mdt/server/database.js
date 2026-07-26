'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { mdtError } = require('./errors');

function nowIso() {
  return new Date().toISOString();
}

function publicId(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function person(row) {
  return row
    ? {
        characterId: row.character_id,
        profile: {
          firstName: row.first_name,
          lastName: row.last_name,
          birthDate: row.birth_date,
          gender: row.gender,
          nationality: row.nationality,
        },
        lastSeenAt: row.last_seen_at,
      }
    : null;
}

function report(row) {
  return row
    ? {
        id: row.public_id,
        title: row.title,
        narrative: row.narrative,
        authorCharacterId: row.author_character_id,
        subjects: parseJson(row.subjects_json, []),
        createdAt: row.created_at,
      }
    : null;
}

function warrant(row) {
  return row
    ? {
        id: row.public_id,
        subjectCharacterId: row.subject_character_id,
        reason: row.reason,
        authorCharacterId: row.author_character_id,
        status: row.status,
        createdAt: row.created_at,
        closedAt: row.closed_at,
      }
    : null;
}

function bolo(row) {
  return row
    ? {
        id: row.public_id,
        type: row.bolo_type,
        value: row.bolo_value,
        reason: row.reason,
        authorCharacterId: row.author_character_id,
        status: row.status,
        createdAt: row.created_at,
        closedAt: row.closed_at,
      }
    : null;
}

class MdtDatabase {
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
      throw mdtError(
        'DATABASE_NEWER',
        `database schema ${version} is newer than this resource supports`,
      );
    }
    if (version === 0) {
      this.database.exec(`
        BEGIN IMMEDIATE;

        CREATE TABLE mdt_people (
          character_id TEXT PRIMARY KEY,
          first_name TEXT NOT NULL,
          last_name TEXT NOT NULL,
          birth_date TEXT NOT NULL,
          gender TEXT NOT NULL,
          nationality TEXT NOT NULL,
          last_seen_at TEXT NOT NULL
        ) STRICT, WITHOUT ROWID;

        CREATE TABLE mdt_reports (
          id INTEGER PRIMARY KEY,
          public_id TEXT NOT NULL UNIQUE,
          title TEXT NOT NULL,
          narrative TEXT NOT NULL,
          author_character_id TEXT NOT NULL,
          subjects_json TEXT NOT NULL,
          created_at TEXT NOT NULL
        ) STRICT;

        CREATE TABLE mdt_report_subjects (
          report_id TEXT NOT NULL,
          character_id TEXT NOT NULL,
          PRIMARY KEY (report_id, character_id),
          FOREIGN KEY (report_id) REFERENCES mdt_reports(public_id)
            ON DELETE CASCADE
        ) STRICT, WITHOUT ROWID;

        CREATE TABLE mdt_warrants (
          id INTEGER PRIMARY KEY,
          public_id TEXT NOT NULL UNIQUE,
          subject_character_id TEXT NOT NULL,
          reason TEXT NOT NULL,
          author_character_id TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('active', 'closed')),
          created_at TEXT NOT NULL,
          closed_at TEXT
        ) STRICT;

        CREATE TABLE mdt_bolos (
          id INTEGER PRIMARY KEY,
          public_id TEXT NOT NULL UNIQUE,
          bolo_type TEXT NOT NULL CHECK (bolo_type IN ('person', 'vehicle')),
          bolo_value TEXT NOT NULL,
          reason TEXT NOT NULL,
          author_character_id TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('active', 'closed')),
          created_at TEXT NOT NULL,
          closed_at TEXT
        ) STRICT;

        CREATE INDEX mdt_people_name_idx
          ON mdt_people(last_name, first_name);
        CREATE INDEX mdt_report_subjects_character_idx
          ON mdt_report_subjects(character_id, report_id);
        CREATE INDEX mdt_warrants_subject_status_idx
          ON mdt_warrants(subject_character_id, status, id DESC);
        CREATE INDEX mdt_bolos_status_idx
          ON mdt_bolos(status, id DESC);

        PRAGMA user_version = 1;
        COMMIT;
      `);
    }
  }

  prepare() {
    this.statements = {
      upsertPerson: this.database.prepare(`
        INSERT INTO mdt_people (
          character_id, first_name, last_name, birth_date,
          gender, nationality, last_seen_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(character_id) DO UPDATE SET
          first_name = excluded.first_name,
          last_name = excluded.last_name,
          birth_date = excluded.birth_date,
          gender = excluded.gender,
          nationality = excluded.nationality,
          last_seen_at = excluded.last_seen_at
      `),
      person: this.database.prepare(
        'SELECT * FROM mdt_people WHERE character_id = ?',
      ),
      searchPeople: this.database.prepare(`
        SELECT * FROM mdt_people
        WHERE character_id LIKE ?
           OR first_name LIKE ?
           OR last_name LIKE ?
           OR (first_name || ' ' || last_name) LIKE ?
        ORDER BY last_name, first_name
        LIMIT ?
      `),
      insertReport: this.database.prepare(`
        INSERT INTO mdt_reports (
          public_id, title, narrative, author_character_id,
          subjects_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `),
      insertReportSubject: this.database.prepare(`
        INSERT INTO mdt_report_subjects (report_id, character_id)
        VALUES (?, ?)
      `),
      report: this.database.prepare(
        'SELECT * FROM mdt_reports WHERE public_id = ?',
      ),
      reportsForSubject: this.database.prepare(`
        SELECT report.*
        FROM mdt_reports AS report
        JOIN mdt_report_subjects AS subject
          ON subject.report_id = report.public_id
        WHERE subject.character_id = ?
        ORDER BY report.id DESC
        LIMIT ?
      `),
      recentReports: this.database.prepare(`
        SELECT * FROM mdt_reports ORDER BY id DESC LIMIT ?
      `),
      insertWarrant: this.database.prepare(`
        INSERT INTO mdt_warrants (
          public_id, subject_character_id, reason,
          author_character_id, status, created_at
        ) VALUES (?, ?, ?, ?, 'active', ?)
      `),
      warrant: this.database.prepare(
        'SELECT * FROM mdt_warrants WHERE public_id = ?',
      ),
      warrantsForSubject: this.database.prepare(`
        SELECT * FROM mdt_warrants
        WHERE subject_character_id = ?
        ORDER BY id DESC
        LIMIT ?
      `),
      activeWarrants: this.database.prepare(`
        SELECT * FROM mdt_warrants
        WHERE status = 'active'
        ORDER BY id DESC
        LIMIT ?
      `),
      closeWarrant: this.database.prepare(`
        UPDATE mdt_warrants
        SET status = 'closed', closed_at = ?
        WHERE public_id = ? AND status = 'active'
        RETURNING *
      `),
      insertBolo: this.database.prepare(`
        INSERT INTO mdt_bolos (
          public_id, bolo_type, bolo_value, reason,
          author_character_id, status, created_at
        ) VALUES (?, ?, ?, ?, ?, 'active', ?)
      `),
      bolo: this.database.prepare(
        'SELECT * FROM mdt_bolos WHERE public_id = ?',
      ),
      activeBolos: this.database.prepare(`
        SELECT * FROM mdt_bolos
        WHERE status = 'active'
        ORDER BY id DESC
        LIMIT ?
      `),
      closeBolo: this.database.prepare(`
        UPDATE mdt_bolos
        SET status = 'closed', closed_at = ?
        WHERE public_id = ? AND status = 'active'
        RETURNING *
      `),
      anonymizePerson: this.database.prepare(`
        DELETE FROM mdt_people WHERE character_id = ?
      `),
    };
  }

  syncPerson(character) {
    const profile = character.profile;
    this.statements.upsertPerson.run(
      character.characterId,
      profile.firstName,
      profile.lastName,
      profile.birthDate,
      profile.gender,
      profile.nationality,
      nowIso(),
    );
    return this.getPerson(character.characterId);
  }

  getPerson(characterId) {
    return person(this.statements.person.get(characterId));
  }

  searchPeople(query, limit) {
    const term = `%${query}%`;
    return this.statements.searchPeople
      .all(term, term, term, term, limit)
      .map(person);
  }

  createReport(author, title, narrative, subjects) {
    const id = publicId('rpt');
    const timestamp = nowIso();
    this.database.exec('BEGIN IMMEDIATE');
    try {
      this.statements.insertReport.run(
        id,
        title,
        narrative,
        author,
        JSON.stringify(subjects),
        timestamp,
      );
      for (const subject of subjects) {
        this.statements.insertReportSubject.run(id, subject);
      }
      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
    return report(this.statements.report.get(id));
  }

  reportsForSubject(characterId, limit) {
    return this.statements.reportsForSubject.all(characterId, limit).map(report);
  }

  recentReports(limit) {
    return this.statements.recentReports.all(limit).map(report);
  }

  createWarrant(subject, reason, author) {
    const id = publicId('war');
    this.statements.insertWarrant.run(id, subject, reason, author, nowIso());
    return warrant(this.statements.warrant.get(id));
  }

  warrantsForSubject(characterId, limit) {
    return this.statements.warrantsForSubject
      .all(characterId, limit)
      .map(warrant);
  }

  activeWarrants(limit) {
    return this.statements.activeWarrants.all(limit).map(warrant);
  }

  closeWarrant(id) {
    return warrant(this.statements.closeWarrant.get(nowIso(), id));
  }

  createBolo(type, value, reason, author) {
    const id = publicId('bol');
    this.statements.insertBolo.run(id, type, value, reason, author, nowIso());
    return bolo(this.statements.bolo.get(id));
  }

  activeBolos(limit) {
    return this.statements.activeBolos.all(limit).map(bolo);
  }

  closeBolo(id) {
    return bolo(this.statements.closeBolo.get(nowIso(), id));
  }

  deleteCharacter(characterId) {
    return Number(this.statements.anonymizePerson.run(characterId).changes);
  }

  close() {
    this.database.close();
  }
}

module.exports = {
  MdtDatabase,
  publicId,
};
