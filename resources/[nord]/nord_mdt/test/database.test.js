'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { MdtDatabase } = require('../server/database');

test('people, reports, warrants, and BOLOs persist', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'varde-mdt-'));
  const database = new MdtDatabase(path.join(directory, 'mdt.sqlite'));
  const subject = {
    characterId: 'vrd_1111111111111111',
    profile: {
      firstName: 'Alex',
      lastName: 'Smith',
      birthDate: '2000-01-01',
      gender: 'x',
      nationality: 'US',
    },
  };
  database.syncPerson(subject);
  assert.equal(database.searchPeople('Smith', 10).length, 1);

  const report = database.createReport(
    'vrd_2222222222222222',
    'Traffic stop',
    'A complete report narrative.',
    [subject.characterId],
  );
  assert.equal(database.reportsForSubject(subject.characterId, 10)[0].id, report.id);

  const warrant = database.createWarrant(
    subject.characterId,
    'Failure to appear',
    'vrd_2222222222222222',
  );
  assert.equal(database.closeWarrant(warrant.id).status, 'closed');

  const bolo = database.createBolo(
    'vehicle',
    'ABC123',
    'Wanted vehicle',
    'vrd_2222222222222222',
  );
  assert.equal(database.closeBolo(bolo.id).status, 'closed');
  database.close();
});
