'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { BankingDatabase } = require('../server/database');

test('bank profiles receive stable unique account numbers', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'Nord-banking-'));
  const database = new BankingDatabase(path.join(directory, 'banking.sqlite'));
  t.after(() => {
    database.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  const first = database.ensure('vrd_0123456789abcdef', 'VRD', 10);
  const again = database.ensure('vrd_0123456789abcdef', 'VRD', 10);
  const second = database.ensure('vrd_fedcba9876543210', 'VRD', 10);

  assert.match(first.accountNumber, /^VRD\d{10}$/u);
  assert.equal(again.accountNumber, first.accountNumber);
  assert.notEqual(second.accountNumber, first.accountNumber);
  assert.equal(
    database.getByAccount(first.accountNumber).characterId,
    first.characterId,
  );
  assert.equal(database.count(), 2);
});

test('deleting a character removes only its banking profile', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'Nord-banking-'));
  const database = new BankingDatabase(path.join(directory, 'banking.sqlite'));
  t.after(() => {
    database.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const profile = database.ensure('vrd_0123456789abcdef', 'VRD', 10);
  assert.equal(database.deleteCharacter(profile.characterId), true);
  assert.equal(database.getByCharacter(profile.characterId), null);
  assert.equal(database.deleteCharacter(profile.characterId), false);
});
