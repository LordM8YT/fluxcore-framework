'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { BusinessesDatabase } = require('../server/database');

test('business ownership, memberships, and treasury persist', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'Nord-businesses-'));
  const database = new BusinessesDatabase(
    path.join(directory, 'businesses.sqlite'),
  );
  t.after(() => {
    database.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const owner = 'vrd_0123456789abcdef';
  const employee = 'vrd_fedcba9876543210';
  const company = database.create('mechanic', 'Harmony Repairs', owner, 'test');

  assert.match(company.id, /^biz_[a-f0-9]{16}$/u);
  assert.equal(database.getMember(company.id, owner).role, 'owner');
  database.setMember(company.id, employee, 'employee', 'test');
  database.setActive(company.id, employee, 'test');
  assert.equal(database.getMember(company.id, employee).active, true);

  assert.equal(
    database.changeTreasury(
      company.id,
      5000,
      100000,
      'sale',
      'sale:1',
      'test',
    ),
    5000,
  );
  assert.equal(
    database.changeTreasury(
      company.id,
      -1250,
      100000,
      'purchase',
      'purchase:1',
      'test',
    ),
    3750,
  );
  assert.equal(database.ledger(company.id, 10).length, 2);
});

test('character deletion disables owned businesses and clears memberships', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'Nord-businesses-'));
  const database = new BusinessesDatabase(
    path.join(directory, 'businesses.sqlite'),
  );
  t.after(() => {
    database.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const owner = 'vrd_0123456789abcdef';
  const company = database.create('restaurant', 'Test Diner', owner, 'test');
  const result = database.deleteCharacter(owner);

  assert.deepEqual(result, { disabled: 1, memberships: 1 });
  assert.equal(database.get(company.id).active, false);
  assert.equal(database.get(company.id).ownerCharacterId, null);
});
