'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { PropertiesDatabase } = require('../server/database');

test('purchase reservations, ownership, keys, and locks persist', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'Fluxcore-properties-'));
  const database = new PropertiesDatabase(path.join(directory, 'properties.sqlite'));
  database.syncDefinitions({
    test_home: { id: 'test_home', label: 'Test Home' },
  });
  assert.equal(database.reserve('test_home', 'token'), true);
  assert.equal(database.reserve('test_home', 'other'), false);
  const purchased = database.finalize(
    'test_home',
    'token',
    'vrd_1111111111111111',
    100,
    'purchase:test',
  );
  assert.equal(purchased.ownerCharacterId, 'vrd_1111111111111111');
  database.addKey(
    'test_home',
    'vrd_2222222222222222',
    'vrd_1111111111111111',
  );
  assert.equal(
    database.hasAccess('test_home', 'vrd_2222222222222222'),
    true,
  );
  assert.equal(database.setLocked('test_home', false).locked, false);
  database.close();
});
