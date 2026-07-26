'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { DispatchDatabase } = require('../server/database');

test('calls persist unit assignment and terminal closure', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'Fluxcore-dispatch-'));
  const database = new DispatchDatabase(path.join(directory, 'dispatch.sqlite'));
  const call = database.create(
    'police',
    'vrd_1111111111111111',
    'Police',
    'Suspicious vehicle',
    2,
    { x: 1, y: 2, z: 3 },
  );
  assert.match(call.id, /^dsp_[a-f0-9]{16}$/u);
  assert.equal(call.status, 'open');

  assert.equal(
    database.assign(call.id, 'vrd_2222222222222222').call.status,
    'assigned',
  );
  assert.equal(database.get(call.id).units.length, 1);
  assert.equal(
    database.unassign(call.id, 'vrd_2222222222222222').call.status,
    'open',
  );
  assert.equal(database.closeCall(call.id).status, 'closed');
  assert.equal(database.closeCall(call.id), null);

  database.close();
});
