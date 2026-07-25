'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { WorldDatabase } = require('../server/database');

test('door state and purchase audit persist', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'Nord-world-'));
  const database = new WorldDatabase(path.join(directory, 'world.sqlite'));
  database.syncDoors({
    police_door: {
      id: 'police_door',
      label: 'Police Door',
      defaultLocked: true,
    },
  });
  assert.equal(database.getDoor('police_door').locked, true);
  assert.equal(
    database.setDoor('police_door', false, 'vrd_1111111111111111').locked,
    false,
  );
  database.recordPurchase(
    'item',
    'shop',
    'vrd_1111111111111111',
    'water',
    2,
    16,
    'shop:test',
  );
  assert.equal(database.purchases('vrd_1111111111111111')[0].amount, 16);
  database.close();
});
